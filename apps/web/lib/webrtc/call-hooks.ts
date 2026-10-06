import type { CallEndReason } from './call-end-notice'

/**
 * UI callbacks for a 1-on-1 call, set by the call components on the
 * `callManager` façade and fired by whichever engine (mesh / sfu) runs the call.
 */
export interface CallHooks {
  onLocalStream: ((s: MediaStream) => void) | null
  onRemoteStream: ((s: MediaStream) => void) | null
  onEnded: (() => void) | null
  /**
   * Fired after a call ended, so the UI can explain why (see `endNoticeKey`).
   * `byPeer` = the other side ended it. `peerName` is captured before the
   * store is reset.
   */
  onEndNotice: ((reason: CallEndReason, byPeer: boolean, peerName: string) => void) | null
}

/** UI callbacks for a group call, set on the `groupCallManager` façade. */
export interface GroupCallHooks {
  /** Local preview stream callback (set by GroupCallModal). */
  onLocalStream: ((s: MediaStream) => void) | null
  /** Fired when teardown completes so the overlay can unmount. */
  onEnded: (() => void) | null
}
