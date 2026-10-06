import axios from 'axios'

/**
 * Typed error → localized message for chat-service (and the friends endpoints of
 * auth-service, which share the top-level `{ code, params }` body shape).
 *
 * The `message` / `error` text next to the code is English diagnostics and must
 * never reach the UI (.claude/rules/no-raw-system-data-in-ui.md): every surface
 * maps the code to a key of the `chat` namespace instead, and only falls back to
 * the caller's generic key when the failure is genuinely unknown.
 */

type Translate = (key: string, values?: Record<string, string | number>) => string

/** Server-side cap on pinned messages per conversation (chat-service `MAX_PINNED_MESSAGES`). */
export const MAX_PINNED_MESSAGES = 5

export interface ChatErrorInfo {
  status?: number
  code?: string
  params?: Record<string, string | number>
  /** No response at all (offline, DNS, CORS-looking network failure). */
  network?: boolean
}

/** Pull `{ status, code, params }` out of an axios error (anything else → `{}`). */
export function parseChatError(err: unknown): ChatErrorInfo {
  if (!axios.isAxiosError(err)) return {}
  if (!err.response) return { network: true }
  const data = err.response.data as { code?: unknown; params?: unknown } | undefined
  const code = typeof data?.code === 'string' && data.code ? data.code : undefined
  const params =
    data?.params && typeof data.params === 'object' && !Array.isArray(data.params)
      ? (data.params as Record<string, string | number>)
      : undefined
  return { status: err.response.status, code, params }
}

/** Code → `chat.*` message key. Codes not listed fall back to the caller's key. */
const CODE_KEYS: Record<string, string> = {
  GROUP_ADMIN_REQUIRED: 'errGroupAdminRequired',
  USER_BLOCKED: 'errUserBlocked',
  REPLY_TARGET_INVALID: 'errReplyTargetInvalid',
  MESSAGE_TYPE_NOT_ALLOWED: 'errMessageTypeNotAllowed',
  INVALID_URL: 'errInvalidUrl',
  INVALID_PARAMETER: 'errInvalidParameter',
  NOT_A_GROUP: 'errNotAGroup',
  NOT_A_MEMBER: 'errNotAMember',
  LAST_ADMIN_CANNOT_BE_REMOVED: 'errLastAdminCannotBeRemoved',
  PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED: 'errPublicDepartmentChannel',
  RATE_LIMITED: 'errRateLimited',
  // STOMP MESSAGE_REJECTED codes for an unknown / non-member conversation.
  NOT_FOUND: 'errConversationUnavailable',
  FORBIDDEN: 'errForbidden',
}

/** The `chat.*` key (and values) for a parsed error, or null when it is unknown. */
export function chatErrorKey(
  info: ChatErrorInfo,
): { key: string; values?: Record<string, string | number> } | null {
  if (info.code === 'PIN_LIMIT_REACHED') {
    const max = Number(info.params?.max)
    return { key: 'pinLimitReached', values: { max: max > 0 ? max : MAX_PINNED_MESSAGES } }
  }
  if (info.code && CODE_KEYS[info.code]) return { key: CODE_KEYS[info.code] }
  // 429 carries no code (link preview 60/min, reactions 30/min, forward/send burst).
  if (info.status === 429) return { key: 'errRateLimited' }
  if (info.network) return { key: 'errNetwork' }
  return null
}

/** Localized text for a parsed error; `fallbackKey` (a `chat.*` key) when unknown. */
export function chatCodeMessage(info: ChatErrorInfo, t: Translate, fallbackKey: string): string {
  const mapped = chatErrorKey(info)
  return mapped ? t(mapped.key, mapped.values) : t(fallbackKey)
}

/** Localized text for any thrown error; `fallbackKey` (a `chat.*` key) when unknown. */
export function chatErrorMessage(err: unknown, t: Translate, fallbackKey: string): string {
  return chatCodeMessage(parseChatError(err), t, fallbackKey)
}

/** The conversation id a 409 "conversation already exists" body points at, if any. */
export function existingConversationId(err: unknown): string | undefined {
  if (!axios.isAxiosError(err) || err.response?.status !== 409) return undefined
  const id = (err.response.data as { conversationId?: unknown } | undefined)?.conversationId
  return typeof id === 'string' && id ? id : undefined
}
