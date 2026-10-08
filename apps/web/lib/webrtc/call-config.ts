import type { CallEndReason } from './call-end-notice'

export interface WebRTCSignal {
  senderId?: string
  targetId?: string
  conversationId?: string
  type:
    | 'offer'
    | 'answer'
    | 'ice'
    | 'end'
    | 'call-ring'
    | 'call-blocked'
    /** sfu: stop ringing (answered elsewhere / declined elsewhere / caller gave up). */
    | 'call-ring-cancel'
    /** sfu: the callee declined (callId absent when they were busy and no call was made). */
    | 'call-declined'
    /** sfu: we both tapped Call — the server answered their call for us; join it. */
    | 'call-merged'
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
  /** Ring: which media path the call uses. */
  transport?: 'mesh' | 'sfu'
  /** Ring: 'direct' (1-on-1) or 'group'. */
  kind?: 'direct' | 'group'
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

/** The call was ended (hang-up, peer cancel) while setup was still awaiting. */
export class CallCancelledError extends Error {
  constructor() {
    super('call cancelled during setup')
  }
}

/** A peer telling us it rejected the call: the callee's other sessions may still ring. */
export const REJECTIONS: ReadonlySet<CallEndReason> = new Set<CallEndReason>(['declined', 'busy', 'media_error'])

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
}
