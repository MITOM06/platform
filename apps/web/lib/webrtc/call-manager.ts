import { stompService } from '@/lib/stomp/client'
import { useCallStore } from '@/lib/store/call.store'
import { chatService } from '@/lib/api/chat'
import type { CallEndReason } from './call-end-notice'

export type { CallEndReason } from './call-end-notice'

/**
 * Web counterpart of the Flutter `WebRTCService`. Owns a single
 * `RTCPeerConnection` and drives the call lifecycle over the chat-service STOMP
 * signaling channel (`/app/call.*` → `/user/queue/webrtc`).
 *
 * Uses Unified Plan (`addTrack` / `ontrack`) — matches the mobile peer so SDP
 * negotiation is symmetric.
 */
export interface WebRTCSignal {
  senderId?: string
  targetId?: string
  conversationId?: string
  type: 'offer' | 'answer' | 'ice' | 'end' | 'call-ring' | 'call-blocked'
  sdp?: string
  candidate?: RTCIceCandidateInit
  /** On `end`: why the call ended. Absent from older clients (= 'hangup'). */
  reason?: CallEndReason
  // ── Group-call fields (Track A §3). Absent on legacy 1-on-1 signals. ───────
  /** Present on every mesh signal; routes the signal into the group manager. */
  callId?: string
  /** Mesh peer id the signal was relayed from (server-filled). */
  fromId?: string
  /** Ring metadata (`type:'call-ring'`). */
  startedByName?: string
  media?: 'audio' | 'video'
  aiNotetaker?: boolean
}

/**
 * How long an outgoing 1-on-1 call rings before it is given up as missed.
 * There is no server-side ring state, so without this the caller sat on
 * "Calling…" forever whenever the callee was offline, never saw the ring, or
 * ignored it. Mirrors Flutter `WebRTCService.ringTimeout`.
 */
export const RING_TIMEOUT_MS = 45_000
/** Callee-side safety net, slightly longer than the caller's ring. */
export const INCOMING_RING_TIMEOUT_MS = RING_TIMEOUT_MS + 5_000
/**
 * How long a `disconnected` connection may try to recover (Wi-Fi ↔ 4G hand-off,
 * short loss) before the call is ended. Mirrors Flutter `disconnectGrace`.
 */
export const DISCONNECT_GRACE_MS = 8_000

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
}

class CallManager {
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private targetId: string | null = null
  private conversationId: string | null = null
  private remoteDescriptionSet = false
  private pendingCandidates: RTCIceCandidateInit[] = []
  private ringTimer: ReturnType<typeof setTimeout> | null = null
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * The caller trickles ICE candidates right after its offer — while we are
   * still ringing and have no peer connection. They are kept here (only from
   * the caller that is ringing) and applied on answer; dropping them made
   * calls across NATs connect without audio.
   */
  private expectingFrom: string | null = null
  private earlyCandidates: RTCIceCandidateInit[] = []

  onLocalStream: ((s: MediaStream) => void) | null = null
  onRemoteStream: ((s: MediaStream) => void) | null = null
  onEnded: (() => void) | null = null
  /**
   * Fired after a call ended, so the UI can explain why (see `endNoticeKey`).
   * `byPeer` = the other side ended it. `peerName` is captured before the
   * store is reset.
   */
  onEndNotice: ((reason: CallEndReason, byPeer: boolean, peerName: string) => void) | null = null

  getLocalStream(): MediaStream | null {
    return this.localStream
  }
  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  /**
   * Start an outgoing call to `targetId`. `video=false` → audio-only voice call.
   * Rejects (after resetting the call UI) when the camera/mic can't be opened,
   * so the caller is never left on "Calling…" for a call that was never placed.
   */
  async startCall(
    targetId: string,
    targetName: string,
    conversationId: string,
    video = true,
  ): Promise<void> {
    useCallStore.getState().setOutgoing({ peerId: targetId, peerName: targetName, conversationId, video })
    try {
      await this.setup(targetId, conversationId, video)
      const offer = await this.pc!.createOffer()
      await this.pc!.setLocalDescription(offer)
      stompService.publish('/app/call.offer', {
        targetId,
        conversationId,
        type: 'offer',
        sdp: offer.sdp,
      })
    } catch (err) {
      this.teardown(true)
      throw err
    }
    this.ringTimer = setTimeout(() => {
      this.ringTimer = null
      if (useCallStore.getState().status !== 'outgoing') return
      this.endCall('no_answer')
    }, RING_TIMEOUT_MS)
  }

  /** Accept the incoming offer currently held in the store. */
  async acceptIncoming(): Promise<void> {
    const { peerId, conversationId, pendingOfferSdp } = useCallStore.getState()
    // `this.pc` is set synchronously at the start of setup(): a double click
    // on Answer must not build a second connection.
    if (!peerId || !conversationId || !pendingOfferSdp || this.pc) return
    // Match the caller's media: only enable local video if the offer has a video m-line.
    const video = pendingOfferSdp.includes('m=video')
    try {
      await this.setup(peerId, conversationId, video)
    } catch {
      // Mic/camera denied or missing: tell the caller instead of leaving
      // them ringing, and explain it locally.
      this.endCall('media_error')
      return
    }
    await this.pc!.setRemoteDescription({ type: 'offer', sdp: pendingOfferSdp })
    await this.flushPending()
    const answer = await this.pc!.createAnswer()
    await this.pc!.setLocalDescription(answer)
    stompService.publish('/app/call.answer', {
      targetId: peerId,
      conversationId,
      type: 'answer',
      sdp: answer.sdp,
    })
  }

  /** Route an inbound 1-on-1 signal (from `/user/queue/webrtc`). */
  handleSignal(signal: WebRTCSignal): void {
    switch (signal.type) {
      case 'offer':
        this.handleOffer(signal)
        break
      case 'answer':
        void this.handleAnswer(signal.sdp ?? '')
        break
      case 'ice':
        if (signal.candidate) void this.addCandidate(signal.candidate, signal.senderId)
        break
      case 'end':
        this.handleRemoteEnd(signal)
        break
    }
  }

  /** Hang up / decline / give up, notify the peer with `reason`, log the call. */
  endCall(reason: CallEndReason = 'hangup'): void {
    const store = useCallStore.getState()
    // Fall back to the store when rejecting an incoming call that was never
    // set up (peer connection not created yet) — the caller must still be told.
    const targetId = this.targetId ?? store.peerId
    const conversationId = this.conversationId ?? store.conversationId
    const peerName = store.peerName
    if (targetId && conversationId) {
      stompService.publish('/app/call.end', {
        targetId,
        conversationId,
        type: 'end',
        reason,
        duration: store.durationSeconds,
      })
    }
    // Emit a system message so both sides see the call log in the chat history.
    // Only the hang-up initiator sends this (the peer's teardown via 'end'
    // signal does not call endCall, preventing duplicate messages).
    if (conversationId) {
      const kind = store.video ? 'video' : 'voice'
      this.sendCallLog(
        conversationId,
        store.status === 'connected'
          ? `system.call.ended:${kind}:${store.durationSeconds}`
          : `system.call.missed:${kind}`,
      )
    }
    this.teardown(true)
    this.onEndNotice?.(reason, false, peerName)
  }

  /** The incoming prompt timed out locally (caller vanished without `end`). */
  dismissIncoming(): void {
    this.expectingFrom = null
    this.earlyCandidates = []
    if (useCallStore.getState().status === 'incoming') useCallStore.getState().reset()
  }

  toggleMic(on: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = on))
    useCallStore.getState().setMic(on)
  }

  toggleCamera(on: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on))
    useCallStore.getState().setCamera(on)
  }

  private handleOffer(signal: WebRTCSignal): void {
    const from = signal.senderId
    const conversationId = signal.conversationId
    const sdp = signal.sdp
    if (!from || !conversationId || !sdp) return
    const st = useCallStore.getState()
    if (st.status !== 'idle' || st.groupCallId) {
      // Same caller re-sending (reconnect) → keep ringing; anyone else → busy.
      if (st.peerId === from) return
      stompService.publish('/app/call.end', {
        targetId: from,
        conversationId,
        type: 'end',
        reason: 'busy',
        duration: 0,
      })
      return
    }
    this.expectingFrom = from
    this.earlyCandidates = []
    st.setIncoming({
      peerId: from,
      peerName: '',
      conversationId,
      sdp,
      video: sdp.includes('m=video'),
    })
  }

  private handleRemoteEnd(signal: WebRTCSignal): void {
    const st = useCallStore.getState()
    if (st.status === 'idle') return
    // A late/stray `end` from someone else must never kill the current call.
    if (signal.senderId && st.peerId && signal.senderId !== st.peerId) return
    const reason = signal.reason ?? 'hangup'
    const wasIncoming = st.status === 'incoming'
    const peerName = st.peerName
    if (reason === 'busy' && st.conversationId) {
      // The callee never rang: log the attempt so it shows as a missed call.
      this.sendCallLog(st.conversationId, `system.call.missed:${st.video ? 'video' : 'voice'}`)
    }
    this.teardown(true)
    // A caller cancelling before we answered just makes the prompt go away.
    if (!wasIncoming) this.onEndNotice?.(reason, true, peerName)
  }

  private sendCallLog(conversationId: string, content: string): void {
    chatService.sendMessage(conversationId, content, 'system').catch(() => {
      // best-effort — a failed system message must not block hangup
    })
  }

  private async setup(targetId: string, conversationId: string, video: boolean): Promise<void> {
    this.targetId = targetId
    this.conversationId = conversationId
    this.remoteDescriptionSet = false
    this.pendingCandidates = []

    const pc = new RTCPeerConnection(ICE_SERVERS)
    this.pc = pc
    // Candidates the caller sent while we were ringing (see earlyCandidates).
    if (this.expectingFrom === targetId) this.pendingCandidates.push(...this.earlyCandidates)
    this.expectingFrom = null
    this.earlyCandidates = []

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        stompService.publish('/app/call.ice', {
          targetId,
          conversationId,
          type: 'ice',
          candidate: e.candidate.toJSON(),
        })
      }
    }
    pc.ontrack = (e) => {
      if (e.streams[0]) {
        this.remoteStream = e.streams[0]
        this.onRemoteStream?.(e.streams[0])
        this.clearRingTimer()
        useCallStore.getState().setConnected()
      }
    }
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return
      switch (pc.connectionState) {
        case 'connected':
          this.clearDisconnectTimer()
          break
        case 'disconnected':
          // Often transient (network hand-off): give it a chance to recover.
          this.disconnectTimer ??= setTimeout(() => {
            this.disconnectTimer = null
            if (this.pc === pc) this.endCall('failed')
          }, DISCONNECT_GRACE_MS)
          break
        case 'failed':
          this.endCall('failed')
          break
      }
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    this.onLocalStream?.(this.localStream)
    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream)
    }
  }

  private async handleAnswer(sdp: string): Promise<void> {
    if (!this.pc) return
    await this.pc.setRemoteDescription({ type: 'answer', sdp })
    await this.flushPending()
  }

  private async addCandidate(candidate: RTCIceCandidateInit, from?: string): Promise<void> {
    if (!this.pc) {
      if (from && from === this.expectingFrom) this.earlyCandidates.push(candidate)
      return
    }
    if (!this.remoteDescriptionSet) {
      this.pendingCandidates.push(candidate)
      return
    }
    await this.pc.addIceCandidate(candidate)
  }

  private async flushPending(): Promise<void> {
    this.remoteDescriptionSet = true
    for (const c of this.pendingCandidates) {
      try {
        await this.pc?.addIceCandidate(c)
      } catch {
        // ignore malformed late candidates
      }
    }
    this.pendingCandidates = []
  }

  private clearRingTimer(): void {
    if (this.ringTimer) clearTimeout(this.ringTimer)
    this.ringTimer = null
  }

  private clearDisconnectTimer(): void {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer)
    this.disconnectTimer = null
  }

  /** Tear down media + connection. `notifyUi` resets the store/overlay. */
  private teardown(notifyUi: boolean): void {
    this.clearRingTimer()
    this.clearDisconnectTimer()
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.remoteStream = null
    const pc = this.pc
    this.pc = null // before close(): a 'closed' state change must not re-enter endCall
    pc?.close()
    this.targetId = null
    this.conversationId = null
    this.remoteDescriptionSet = false
    this.pendingCandidates = []
    this.expectingFrom = null
    this.earlyCandidates = []
    if (notifyUi) {
      this.onEnded?.()
      useCallStore.getState().reset()
    }
  }
}

export const callManager = new CallManager()
