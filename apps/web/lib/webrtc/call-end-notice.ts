/**
 * Why a 1-on-1 call ended. Sent as `reason` on the `end` signal and relayed
 * verbatim by chat-service. A missing reason (older client) means 'hangup'.
 * Mirrors Flutter `CallEndReason` (`features/chat/domain/call_rules.dart`).
 */
export type CallEndReason = 'hangup' | 'declined' | 'busy' | 'no_answer' | 'media_error' | 'failed'

/** Keys in the `call` i18n namespace used to explain an ended call. */
export type CallNoticeKey =
  | 'declined'
  | 'busy'
  | 'peerMediaError'
  | 'ended'
  | 'connectionLost'
  | 'noAnswer'
  | 'mediaError'

/**
 * Which message (if any) to show when a call ends. `byPeer` = the other side
 * ended it. Endings the local user chose themselves (hang up, decline) need no
 * explanation.
 */
export function endNoticeKey(reason: CallEndReason, byPeer: boolean): CallNoticeKey | null {
  if (byPeer) {
    switch (reason) {
      case 'declined':
        return 'declined'
      case 'busy':
        return 'busy'
      case 'media_error':
        return 'peerMediaError'
      case 'failed':
        return 'connectionLost'
      case 'hangup':
        return 'ended'
      case 'no_answer':
        return null
    }
  }
  switch (reason) {
    case 'no_answer':
      return 'noAnswer'
    case 'failed':
      return 'connectionLost'
    case 'media_error':
      return 'mediaError'
    default:
      return null
  }
}
