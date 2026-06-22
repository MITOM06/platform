import { stompService } from '@/lib/stomp/client'
import { useCallStore } from '@/lib/store/call.store'
import type { CallMedia, CallParticipant } from '@/lib/api/types'
import type { WebRTCSignal } from './call-manager'

/**
 * Web mesh manager for group calls (Track A contract §2/§3). Owns ONE
 * `RTCPeerConnection` per remote participant, keyed by peerId.
 *
 * Mesh rule (MUST match Flutter): when YOU join and learn the roster, YOU
 * create an offer to every participant ALREADY present. Participants who join
 * AFTER you will offer to YOU. This single-direction rule avoids offer glare.
 * ICE candidates and offers/answers always carry `callId` + `targetId`.
 *
 * The legacy 1-on-1 `callManager` is untouched — signals without a `callId`
 * never reach this manager.
 */

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
}

interface PeerEntry {
  pc: RTCPeerConnection
  stream: MediaStream | null
  remoteDescriptionSet: boolean
  pendingCandidates: RTCIceCandidateInit[]
}

class GroupCallManager {
  private callId: string | null = null
  private localUserId: string | null = null
  private localStream: MediaStream | null = null
  private media: CallMedia = 'video'
  private pendingStart = false
  private peers = new Map<string, PeerEntry>()

  /** Local preview stream callback (set by GroupCallModal). */
  onLocalStream: ((s: MediaStream) => void) | null = null
  /** Fired when teardown completes so the overlay can unmount. */
  onEnded: (() => void) | null = null

  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  /** Remote stream for a peer, or null if not yet negotiated. */
  getRemoteStream(peerId: string): MediaStream | null {
    return this.peers.get(peerId)?.stream ?? null
  }

  isActive(): boolean {
    return this.callId !== null
  }

  /** Start a brand-new group call (the starter). Publishes `call.start`. */
  async startCall(
    conversationId: string,
    localUserId: string,
    media: CallMedia,
    aiNotetaker: boolean,
  ): Promise<void> {
    // The server generates the callId and adds the starter as the first
    // participant, then replies via `call.started`. We capture media + acquire
    // the local stream now so the preview is ready; the store's groupCallId is
    // set when the matching `call.started` arrives (see confirmStarted()).
    this.localUserId = localUserId
    this.media = media
    this.pendingStart = true
    await this.ensureLocalStream(media)
    stompService.publish('/app/call.start', { conversationId, media, aiNotetaker })
  }

  /**
   * The starter's own `call.started` arrived. Mirror Flutter
   * (`group_call_signaling.dart`): the starter auto-joins its own call by
   * publishing `call.join` (the server's join handler is idempotent), then the
   * mesh comes online via the resulting `call.roster`. No-op if we didn't
   * initiate this call.
   */
  async confirmStarted(
    callId: string,
    conversationId: string,
    localUserId: string,
    media: CallMedia,
    aiNotetaker: boolean,
  ): Promise<void> {
    if (!this.pendingStart || this.callId) return
    this.pendingStart = false
    await this.join(callId, conversationId, localUserId, media, aiNotetaker)
  }

  /**
   * Join an active group call (either the starter after `call.started`, or an
   * invitee who accepted a ring, or a banner click). Idempotent per callId.
   */
  async join(
    callId: string,
    conversationId: string,
    localUserId: string,
    media: CallMedia,
    aiNotetaker: boolean,
  ): Promise<void> {
    if (this.callId === callId) return
    this.callId = callId
    this.localUserId = localUserId
    this.media = media
    useCallStore.getState().startGroupCall({ callId, conversationId, media, aiNotetaker })
    await this.ensureLocalStream(media)
    stompService.publish('/app/call.join', { callId })
  }

  /**
   * Apply a fresh roster (`call.roster`). Glare-avoidance rule (MUST match
   * Flutter `GroupCallController.applyRoster`): we offer ONLY to peers we don't
   * yet have a connection to AND that joined before us — approximated by
   * `joinedAt <= self.joinedAt`. Peers who joined after us will offer to us.
   * Departed peers are torn down.
   */
  async applyRoster(participants: CallParticipant[]): Promise<void> {
    if (!this.callId || !this.localUserId) return
    useCallStore.getState().setRoster(participants)

    const present = participants.filter((p) => !p.leftAt)
    const presentIds = new Set(present.map((p) => p.userId))

    const self = present.find((p) => p.userId === this.localUserId)
    const selfJoined = self?.joinedAt ? Date.parse(self.joinedAt) : Date.now()

    const existingToOffer = present.filter(
      (p) =>
        p.userId !== this.localUserId &&
        !this.peers.has(p.userId) &&
        (!p.joinedAt || Date.parse(p.joinedAt) <= selfJoined),
    )
    for (const p of existingToOffer) {
      await this.offerTo(p.userId)
    }

    // Tear down peers who left.
    for (const peerId of [...this.peers.keys()]) {
      if (!presentIds.has(peerId)) this.closePeer(peerId)
    }
  }

  /** Route an inbound mesh signal (carries a callId). */
  handleSignal(signal: WebRTCSignal): void {
    if (!signal.callId || signal.callId !== this.callId) return
    const from = signal.fromId
    if (!from) return
    switch (signal.type) {
      case 'offer':
        void this.handleOffer(from, signal.sdp ?? '')
        break
      case 'answer':
        void this.handleAnswer(from, signal.sdp ?? '')
        break
      case 'ice':
        if (signal.candidate) void this.addCandidate(from, signal.candidate)
        break
    }
  }

  toggleMic(on: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = on))
    useCallStore.getState().setMic(on)
  }

  toggleCamera(on: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on))
    useCallStore.getState().setCamera(on)
  }

  /** Leave the call: notify server, tear down all peers + local media. */
  leave(): void {
    if (this.callId) stompService.publish('/app/call.leave', { callId: this.callId })
    this.teardown()
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private async ensureLocalStream(media: CallMedia): Promise<void> {
    if (this.localStream) return
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: media === 'video',
    })
    this.onLocalStream?.(this.localStream)
  }

  private createPeer(peerId: string): PeerEntry {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    const entry: PeerEntry = { pc, stream: null, remoteDescriptionSet: false, pendingCandidates: [] }
    this.peers.set(peerId, entry)

    pc.onicecandidate = (e) => {
      if (e.candidate && this.callId) {
        stompService.publish('/app/call.ice', {
          callId: this.callId,
          targetId: peerId,
          candidate: e.candidate.toJSON(),
        })
      }
    }
    pc.ontrack = (e) => {
      if (e.streams[0]) {
        entry.stream = e.streams[0]
        useCallStore.getState().setGroupActive()
        useCallStore.getState().bumpStreams()
      }
    }
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        this.closePeer(peerId)
      }
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) pc.addTrack(track, this.localStream)
    }
    return entry
  }

  private async offerTo(peerId: string): Promise<void> {
    if (!this.callId) return
    const entry = this.createPeer(peerId)
    const offer = await entry.pc.createOffer()
    await entry.pc.setLocalDescription(offer)
    stompService.publish('/app/call.offer', {
      callId: this.callId,
      targetId: peerId,
      sdp: offer.sdp,
    })
  }

  private async handleOffer(from: string, sdp: string): Promise<void> {
    if (!this.callId) return
    // A peer that joined after us offers to us → create the answering peer.
    const entry = this.peers.get(from) ?? this.createPeer(from)
    await entry.pc.setRemoteDescription({ type: 'offer', sdp })
    await this.flushPending(from)
    const answer = await entry.pc.createAnswer()
    await entry.pc.setLocalDescription(answer)
    stompService.publish('/app/call.answer', {
      callId: this.callId,
      targetId: from,
      sdp: answer.sdp,
    })
  }

  private async handleAnswer(from: string, sdp: string): Promise<void> {
    const entry = this.peers.get(from)
    if (!entry) return
    await entry.pc.setRemoteDescription({ type: 'answer', sdp })
    await this.flushPending(from)
  }

  private async addCandidate(from: string, candidate: RTCIceCandidateInit): Promise<void> {
    const entry = this.peers.get(from)
    if (!entry) return
    if (!entry.remoteDescriptionSet) {
      entry.pendingCandidates.push(candidate)
      return
    }
    try {
      await entry.pc.addIceCandidate(candidate)
    } catch {
      // ignore malformed candidate
    }
  }

  private async flushPending(from: string): Promise<void> {
    const entry = this.peers.get(from)
    if (!entry) return
    entry.remoteDescriptionSet = true
    for (const c of entry.pendingCandidates) {
      try {
        await entry.pc.addIceCandidate(c)
      } catch {
        // ignore late malformed candidate
      }
    }
    entry.pendingCandidates = []
  }

  private closePeer(peerId: string): void {
    const entry = this.peers.get(peerId)
    if (!entry) return
    entry.pc.close()
    this.peers.delete(peerId)
    useCallStore.getState().bumpStreams()
  }

  private teardown(): void {
    for (const peerId of [...this.peers.keys()]) {
      this.peers.get(peerId)?.pc.close()
      this.peers.delete(peerId)
    }
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.callId = null
    this.localUserId = null
    this.pendingStart = false
    this.onLocalStream = null
    this.onEnded?.()
    useCallStore.getState().resetGroup()
  }

  /** Server-driven end (`call.ended`) — tear down without re-publishing leave. */
  handleEnded(callId: string): void {
    if (this.callId !== callId) return
    this.teardown()
  }
}

export const groupCallManager = new GroupCallManager()
