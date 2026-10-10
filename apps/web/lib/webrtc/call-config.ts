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
    /** 1-on-1 in-call state from the other person (`/app/call.state`). */
    | 'state'
    /** mesh: we answered `senderId`'s call on another device — stop ringing here. */
    | 'answered-elsewhere'
  sdp?: string
  candidate?: RTCIceCandidateInit
  /** On `end`: why the call ended. Absent from older clients (= 'hangup'). */
  reason?: CallEndReason
  /** On `state`: the sender's camera is on. */
  video?: boolean
  /** On `state`: how well the sender receives us. */
  quality?: 'good' | 'poor'
  /** On `state`: the sender asks the caller for a fresh offer (reconnect / video line). */
  restart?: boolean
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
 * How long a dropped 1-on-1 may try to recover (Wi-Fi ↔ 4G hand-off, a tunnel,
 * a lost network) before the call is ended; the call screen shows "waiting to
 * reconnect" meanwhile. Mirrors Flutter `disconnectGrace` and the server.
 */
export const DISCONNECT_GRACE_MS = 60_000
/** Same window, by its user-facing name: the "waiting to reconnect" screen. */
export const RECONNECT_GRACE_MS = DISCONNECT_GRACE_MS
/**
 * A drop shorter than this is a blip the connection usually rides out by
 * itself (a Wi-Fi roam, a busy cell): no wait screen, no ICE restart for it.
 * Mirrors Flutter `ReconnectWatch.blip`.
 */
export const RECONNECT_BLIP_MS = 2_500
/**
 * A callee that turned its camera on waits this long for the caller's offer
 * with a video line. An older caller app never sends one: the camera goes back
 * off and the call says video is not available. Mirrors Flutter `cameraOfferWait`.
 */
export const CAMERA_OFFER_WAIT_MS = 5_000
/** How long the "video is not available" notice stays up. */
export const VIDEO_UNAVAILABLE_NOTICE_MS = 6_000

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
