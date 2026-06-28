import { stompService } from '@/lib/stomp/client'
import { useCallStore } from '@/lib/store/call.store'
import { chatService } from '@/lib/api/chat'

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

  onLocalStream: ((s: MediaStream) => void) | null = null
  onRemoteStream: ((s: MediaStream) => void) | null = null
  onEnded: (() => void) | null = null

  getLocalStream(): MediaStream | null {
    return this.localStream
  }
  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  /** Start an outgoing call to `targetId`. `video=false` → audio-only voice call. */
  async startCall(
    targetId: string,
    targetName: string,
    conversationId: string,
    video = true,
  ): Promise<void> {
    useCallStore.getState().setOutgoing({ peerId: targetId, peerName: targetName, conversationId, video })
    await this.setup(targetId, conversationId, video)
    const offer = await this.pc!.createOffer()
    await this.pc!.setLocalDescription(offer)
    stompService.publish('/app/call.offer', {
      targetId,
      conversationId,
      type: 'offer',
      sdp: offer.sdp,
    })
  }

  /** Accept the incoming offer currently held in the store. */
  async acceptIncoming(): Promise<void> {
    const { peerId, conversationId, pendingOfferSdp } = useCallStore.getState()
    if (!peerId || !conversationId || !pendingOfferSdp) return
    // Match the caller's media: only enable local video if the offer has a video m-line.
    const video = pendingOfferSdp.includes('m=video')
    await this.setup(peerId, conversationId, video)
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

  /** Route an inbound signal (from `/user/queue/webrtc`). */
  handleSignal(signal: WebRTCSignal): void {
    switch (signal.type) {
      case 'answer':
        void this.handleAnswer(signal.sdp ?? '')
        break
      case 'ice':
        if (signal.candidate) void this.addCandidate(signal.candidate)
        break
      case 'end':
        this.teardown(true)
        break
    }
  }

  /** Hang up an active/ringing call and notify the peer. */
  endCall(): void {
    const store = useCallStore.getState()
    // Fall back to the store when rejecting an incoming call that was never
    // set up (peer connection not created yet) — the caller must still be told.
    const targetId = this.targetId ?? store.peerId
    const conversationId = this.conversationId ?? store.conversationId
    if (targetId && conversationId) {
      stompService.publish('/app/call.end', {
        targetId,
        conversationId,
        type: 'end',
        duration: store.durationSeconds,
      })
    }
    // Emit a system message so both sides see the call log in the chat history.
    // Only the hang-up initiator sends this (the peer's teardown via 'end'
    // signal does not call endCall, preventing duplicate messages).
    if (conversationId) {
      const kind = store.video ? 'video' : 'voice'
      const wasConnected = store.status === 'connected'
      const content = wasConnected
        ? `system.call.ended:${kind}:${store.durationSeconds}`
        : `system.call.missed:${kind}`
      chatService.sendMessage(conversationId, content, 'system').catch(() => {
        // best-effort — a failed system message must not block hangup
      })
    }
    this.teardown(true)
  }

  toggleMic(on: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = on))
    useCallStore.getState().setMic(on)
  }

  toggleCamera(on: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on))
    useCallStore.getState().setCamera(on)
  }

  private async setup(targetId: string, conversationId: string, video: boolean): Promise<void> {
    this.targetId = targetId
    this.conversationId = conversationId
    this.remoteDescriptionSet = false
    this.pendingCandidates = []

    const pc = new RTCPeerConnection(ICE_SERVERS)
    this.pc = pc

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
        useCallStore.getState().setConnected()
      }
    }
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        this.teardown(true)
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

  private async addCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return
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

  /** Tear down media + connection. `notifyUi` resets the store/overlay. */
  private teardown(notifyUi: boolean): void {
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.remoteStream = null
    this.pc?.close()
    this.pc = null
    this.targetId = null
    this.conversationId = null
    this.remoteDescriptionSet = false
    this.pendingCandidates = []
    if (notifyUi) {
      this.onEnded?.()
      useCallStore.getState().reset()
    }
  }
}

export const callManager = new CallManager()
