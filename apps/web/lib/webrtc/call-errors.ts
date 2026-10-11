import { parseChatError } from '@/lib/api/chat-errors'
import type { CallFailureKey } from './call-end-notice'

/**
 * chat-service call REST errors (`{error, code, statusCode}`, e.g. the room
 * token) → a `call.*` message key. The English `error` text next to the code
 * never reaches the UI (.claude/rules/no-raw-system-data-in-ui.md).
 */
const CODE_KEYS: Record<string, CallFailureKey> = {
  CALLS_UNAVAILABLE: 'errUnavailable',
  CALL_NOT_FOUND: 'errNotFound',
  CALL_ENDED: 'errEnded',
  CALL_NOT_SFU: 'errNotSfu',
  CALL_FORBIDDEN: 'errForbidden',
}

export function callErrorNotice(err: unknown): CallFailureKey {
  const info = parseChatError(err)
  if (info.code && CODE_KEYS[info.code]) return CODE_KEYS[info.code]
  // A bare 503 (proxy, an older server): calls are down all the same.
  if (info.status === 503) return 'errUnavailable'
  if (info.network) return 'errNetwork'
  return 'errFailed'
}
