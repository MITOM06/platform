import { stompService } from '@/lib/stomp/client'
import { useCallStore } from '@/lib/store/call.store'
import { chatService } from '@/lib/api/chat'
import type { CallEndReason } from './call-end-notice'
import { IceQueue } from './ice-queue'
import { MeshNegotiator } from './mesh-negotiator'
import { MeshInCall } from './mesh-in-call'
import type { CallHooks } from './call-hooks'
import {
  CallCancelledError,
  ICE_SERVERS,
  REJECTIONS,
  RING_TIMEOUT_MS,
  type WebRTCSignal,
} from './call-config'

/**
 * The peer-to-peer (mesh) engine for 1-on-1 calls — the path used while the
 * server runs `CALL_TRANSPORT=mesh`. Web counterpart of the Flutter
 * `WebRTCService`. Owns a single `RTCPeerConnection` and drives the call
 * lifecycle over the chat-service STOMP signaling channel (`/app/call.*` →
 * `/user/queue/webrtc`). Unified Plan (`addTrack` / `ontrack`) — matches the
 * mobile peer so SDP is symmetric. UI callbacks live on the `callManager`
 * façade and are reached through `hooks`.
 */
export class MeshCallManager {
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private targetId: string | null = null
  private conversationId: string | null = null
  private ringTimer: ReturnType<typeof setTimeout> | null = null
  private readonly ice = new IceQueue()
  /** Caller only: the offer has left. Before that, hanging up signals nothing. */
  private offerSent = false
  /** We placed this call: only the caller offers (see MeshNegotiator). */
  private caller = false
  /** ICE reached `connected` at least once: only then is a drop worth waiting for. */
  private iceConnected = false
  private readonly negotiator = new MeshNegotiator({
    pc: () => this.pc,
    target: () =>
      this.targetId && this.conversationId ? { peerId: this.targetId, conversationId: this.conversationId } : null,
    flush: (pc) => this.ice.flush(pc),
  })
  private readonly inCall = new MeshInCall(
    {
      pc: () => this.pc,
      localStream: () => this.localStream,
      isCaller: () => this.caller,
      target: () =>
        this.targetId && this.conversationId ? { peerId: this.targetId, conversationId: this.conversationId } : null,
      onLocalStream: (stream) => this.hooks.onLocalStream?.(stream),
      endCall: (reason) => this.endCall(reason),
    },
    this.negotiator,
  )

  constructor(private readonly hooks: CallHooks) {}

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
    this.caller = true
    try {
      const pc = await this.setup(targetId, conversationId, video)
      const offer = await pc.createOffer()
      this.assertLive(pc)
      await pc.setLocalDescription(offer)
      this.assertLive(pc)
      stompService.publish('/app/call.offer', {
        targetId,
        conversationId,
        type: 'offer',
        sdp: offer.sdp,
      })
      this.offerSent = true
    } catch (err) {
      // Hung up while the mic/camera was opening: already torn down, nothing to report.
      if (err instanceof CallCancelledError) return
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
    this.caller = false
    let pc: RTCPeerConnection
    try {
      pc = await this.setup(peerId, conversationId, video)
    } catch (err) {
      // The caller gave up while the permission prompt was open: already gone.
      if (err instanceof CallCancelledError) return
      // Mic/camera denied or missing: tell the caller instead of leaving
      // them ringing, and explain it locally.
      this.endCall('media_error')
      return
    }
    // An unusable offer ends the call instead of leaving the prompt stuck.
    if (!(await this.negotiator.answer(pendingOfferSdp)) && this.pc === pc) this.endCall('failed')
  }

  /**
   * Both tapped Call and the offers crossed. Exactly one side must answer: the
   * one whose user id sorts first drops its own offer (silently — the peer
   * ignores it) and answers theirs; the other keeps its offer and waits.
   */
  private async answerCrossedCall(from: string, conversationId: string, sdp: string): Promise<void> {
    const { peerName, micEnabled, cameraEnabled } = useCallStore.getState()
    const video = sdp.includes('m=video')
    this.teardown(false)
    this.caller = false
    this.ice.expect(from) // their candidates follow their offer
    // Keep showing "Calling…" until media flows; the call takes their media.
    useCallStore.getState().setOutgoing({ peerId: from, peerName, conversationId, video })
    let pc: RTCPeerConnection
    try {
      pc = await this.setup(from, conversationId, video)
    } catch (err) {
      if (err instanceof CallCancelledError) return
      this.endCall('media_error')
      return
    }
    this.offerSent = true // the peer knows about this call: hanging up must tell them
    // Fresh tracks start live: keep what the user muted while "Calling…".
    if (!micEnabled) this.toggleMic(false)
    if (video && !cameraEnabled) this.inCall.toggleCamera(false)
    if (!(await this.negotiator.answer(sdp)) && this.pc === pc) this.endCall('failed')
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
        if (signal.candidate) void this.ice.add(this.pc, signal.candidate, signal.senderId)
        break
      case 'end':
        this.handleRemoteEnd(signal)
        break
      case 'state':
        this.inCall.handleState(signal)
        break
      case 'answered-elsewhere': {
        // Answered on our other device: stop ringing here, quietly (the one that answered has a pc).
        const { peerId, conversationId } = useCallStore.getState()
        if (!this.pc && peerId === signal.senderId && conversationId === signal.conversationId) this.dismissIncoming()
        break
      }
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
    // A caller hanging up before its offer left: the callee never rang.
    const reachedPeer = store.status !== 'outgoing' || this.offerSent
    if (reachedPeer && targetId && conversationId) {
      this.publishEnd(targetId, conversationId, reason, store.durationSeconds)
    }
    // The call log in the chat, sent only by the side hanging up (a peer's `end` never calls endCall).
    if (reachedPeer && conversationId) {
      const kind = store.video ? 'video' : 'voice'
      this.sendCallLog(
        conversationId,
        store.status === 'connected'
          ? `system.call.ended:${kind}:${store.durationSeconds}`
          : `system.call.missed:${kind}`,
      )
    }
    this.teardown(true)
    this.hooks.onEndNotice?.(reason, false, peerName)
  }

  /** The incoming prompt timed out locally (caller vanished without `end`). */
  dismissIncoming(): void {
    this.ice.reset()
    if (useCallStore.getState().status === 'incoming') useCallStore.getState().reset()
  }

  toggleMic(on: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = on))
    useCallStore.getState().setMic(on)
  }

  /** Turn our camera on/off — in a voice call this switches it to video (Messenger-style). */
  toggleCamera(on: boolean): void {
    this.inCall.toggleCamera(on)
  }

  private handleOffer(signal: WebRTCSignal): void {
    const from = signal.senderId
    const conversationId = signal.conversationId
    const sdp = signal.sdp
    if (!from || !conversationId || !sdp) return
    const st = useCallStore.getState()
    if (st.status === 'connected' && st.peerId === from && st.conversationId === conversationId && this.pc) {
      // The caller renegotiates mid-call: an ICE restart, or a camera turned on.
      void this.negotiator.answer(sdp)
      return
    }
    if (st.status === 'outgoing' && st.peerId === from && st.conversationId === conversationId) {
      // We are calling each other. `targetId` is us, as the caller addressed it.
      const me = signal.targetId
      if (me && me < from) void this.answerCrossedCall(from, conversationId, sdp)
      return
    }
    if (st.status !== 'idle' || st.groupCallId) {
      // Same caller re-sending (reconnect) → keep ringing; anyone else → busy.
      if (st.peerId !== from) this.publishEnd(from, conversationId, 'busy')
      return
    }
    this.ice.expect(from)
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
    if (REJECTIONS.has(reason) && st.peerId && st.conversationId) {
      // The callee may be signed in elsewhere (web + phone): one session
      // rejected, the others are still ringing — tell them all it is over.
      this.publishEnd(st.peerId, st.conversationId, 'hangup')
    }
    this.teardown(true)
    // A caller cancelling before we answered just makes the prompt go away.
    if (!wasIncoming) this.hooks.onEndNotice?.(reason, true, peerName)
  }

  private publishEnd(targetId: string, conversationId: string, reason: CallEndReason, duration = 0): void {
    stompService.publish('/app/call.end', { targetId, conversationId, type: 'end', reason, duration })
  }

  private sendCallLog(conversationId: string, content: string): void {
    chatService.sendMessage(conversationId, content, 'system').catch(() => {
      // best-effort — a failed system message must not block hangup
    })
  }

  /** Throws when the call was torn down while we were awaiting. */
  private assertLive(pc: RTCPeerConnection): void {
    if (this.pc !== pc) throw new CallCancelledError()
  }

  /** Builds the connection and opens the mic/camera. Resolves with the live pc. */
  private async setup(
    targetId: string,
    conversationId: string,
    video: boolean,
  ): Promise<RTCPeerConnection> {
    this.targetId = targetId
    this.conversationId = conversationId

    const pc = new RTCPeerConnection(ICE_SERVERS)
    this.pc = pc
    this.ice.attach(targetId) // candidates the caller sent while we were ringing

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
      // A video line added mid-call may come without a stream: join it to theirs.
      const stream = e.streams[0] ?? this.remoteStream
      if (!stream) return
      if (!e.streams[0] && !stream.getTracks().includes(e.track)) stream.addTrack(e.track)
      this.remoteStream = stream
      this.hooks.onRemoteStream?.(stream)
      this.clearRingTimer()
      useCallStore.getState().setConnected()
    }
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return
      switch (pc.connectionState) {
        case 'connected':
          this.iceConnected = true
          this.inCall.connected(pc)
          break
        case 'disconnected':
        case 'failed':
          // Mid-call: a minute to recover (network hand-off, a tunnel, lost Wi-Fi).
          if (this.iceConnected) this.inCall.dropped()
          else if (pc.connectionState === 'failed') this.endCall('failed') // never connected
          break
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    if (this.pc !== pc) {
      // Ended while the permission prompt was open: release the late stream.
      stream.getTracks().forEach((t) => t.stop())
      throw new CallCancelledError()
    }
    this.localStream = stream
    this.hooks.onLocalStream?.(stream)
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream)
    }
    return pc
  }

  private async handleAnswer(sdp: string): Promise<void> {
    const pc = this.pc
    if (!pc || pc.signalingState !== 'have-local-offer') return // late or duplicate
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp })
      await this.ice.flush(pc)
    } catch {
      // superseded by a newer offer
    }
    this.negotiator.answered()
  }

  private clearRingTimer(): void {
    if (this.ringTimer) clearTimeout(this.ringTimer)
    this.ringTimer = null
  }

  /** Tear down media + connection. `notifyUi` resets the store/overlay. */
  private teardown(notifyUi: boolean): void {
    this.clearRingTimer()
    this.inCall.reset()
    this.negotiator.reset()
    this.caller = false
    this.iceConnected = false
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.remoteStream = null
    const pc = this.pc
    this.pc = null // before close(): a 'closed' state change must not re-enter endCall
    pc?.close()
    this.targetId = null
    this.conversationId = null
    this.ice.reset()
    this.offerSent = false
    if (notifyUi) {
      this.hooks.onEnded?.()
      useCallStore.getState().reset()
    }
  }
}
