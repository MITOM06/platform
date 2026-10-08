import { stompService } from '@/lib/stomp/client'

/** What the negotiator needs from the call it serves. */
export interface NegotiationLink {
  pc(): RTCPeerConnection | null
  target(): { peerId: string; conversationId: string } | null
  /** Apply the ICE candidates that waited for the remote description. */
  flush(pc: RTCPeerConnection): Promise<void>
}

export interface OfferOptions {
  /** The connection was lost: gather fresh candidates on both sides. */
  iceRestart?: boolean
  /** Make sure the offer carries a video line the callee can send on. */
  videoLine?: boolean
}

/** An unanswered renegotiation older than this no longer blocks the next one. */
const STALE_OFFER_MS = 10_000
/**
 * An ICE restart may replace an unanswered offer only after this long: two
 * restart offers in flight could see answer #1 applied to offer #2, leaving
 * the two sides with mismatched ICE credentials.
 */
const RESTART_RETRY_MS = 3_500

/**
 * Peer-to-peer offer/answer for a 1-on-1, including mid-call renegotiation:
 * an ICE restart after a drop, or a camera turned on in a voice call.
 *
 * Only the caller ever offers, so two renegotiations can never collide; the
 * callee asks for one with `call.state {restart}` and puts a camera it turned
 * on (`holdCamera`) on the video line of the caller's next offer.
 */
export class MeshNegotiator {
  private pending = false
  private pendingSince = 0
  private queued: OfferOptions | null = null
  private heldCamera: { track: MediaStreamTrack; stream: MediaStream } | null = null

  constructor(private readonly link: NegotiationLink) {}

  /** Caller: send a fresh offer. One at a time — a request meanwhile runs after the answer. */
  async offer(opts: OfferOptions = {}): Promise<void> {
    const pc = this.link.pc()
    const target = this.link.target()
    if (!pc || !target) return
    // An ICE restart may replace an offer the lost connection never answered — not a fresh one.
    const wait = opts.iceRestart ? RESTART_RETRY_MS : STALE_OFFER_MS
    if (this.pending && Date.now() - this.pendingSince < wait) {
      this.queued = {
        iceRestart: !!(this.queued?.iceRestart || opts.iceRestart),
        videoLine: !!(this.queued?.videoLine || opts.videoLine),
      }
      return
    }
    if (opts.videoLine && !pc.getTransceivers().some((t) => t.receiver.track?.kind === 'video')) {
      pc.addTransceiver('video', { direction: 'recvonly' })
    }
    this.pending = true
    this.pendingSince = Date.now()
    try {
      const offer = await pc.createOffer({ iceRestart: !!opts.iceRestart })
      if (this.link.pc() !== pc) return
      await pc.setLocalDescription(offer)
      if (this.link.pc() !== pc) return
      stompService.publish('/app/call.offer', {
        targetId: target.peerId,
        conversationId: target.conversationId,
        type: 'offer',
        sdp: offer.sdp,
      })
    } catch {
      this.pending = false
    }
  }

  /** Caller: our offer was answered — run whatever waited for it. */
  answered(): void {
    this.pending = false
    const next = this.queued
    this.queued = null
    if (next) void this.offer(next)
  }

  /**
   * Callee: answer the caller's offer (the first one, or a mid-call one).
   * False when the offer could not be used and the call is still ours to end.
   */
  async answer(sdp: string): Promise<boolean> {
    const pc = this.link.pc()
    const target = this.link.target()
    if (!pc || !target) return true
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp })
      await this.attachHeldCamera(pc)
      await this.link.flush(pc)
      if (this.link.pc() !== pc) return true
      const answer = await pc.createAnswer()
      if (this.link.pc() !== pc) return true
      await pc.setLocalDescription(answer)
      if (this.link.pc() !== pc) return true
      stompService.publish('/app/call.answer', {
        targetId: target.peerId,
        conversationId: target.conversationId,
        type: 'answer',
        sdp: answer.sdp,
      })
      return true
    } catch {
      return this.link.pc() !== pc // a teardown meanwhile is not a failure
    }
  }

  /** Callee: a camera to send once the caller's offer brings a video line. */
  holdCamera(track: MediaStreamTrack, stream: MediaStream): void {
    this.heldCamera = { track, stream }
  }

  reset(): void {
    this.pending = false
    this.queued = null
    this.heldCamera = null // its track belongs to the local stream, stopped with it
  }

  private async attachHeldCamera(pc: RTCPeerConnection): Promise<void> {
    const held = this.heldCamera
    if (!held) return
    if (!pc.getTransceivers().some((t) => t.receiver.track?.kind === 'video')) return
    // addTrack reuses the caller's video line (sendrecv from now on) and carries
    // our stream id, so the caller's ontrack gets it — on every browser.
    pc.addTrack(held.track, held.stream)
    this.heldCamera = null
  }
}
