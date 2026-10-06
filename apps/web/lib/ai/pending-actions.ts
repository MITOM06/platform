import axios from 'axios'
import type { AiPendingAction, Message } from '@/lib/api/types'

/**
 * Confirmation cards for sensitive AI actions (CONTRACTS-ROUND2 §F2).
 *
 * The AI never runs a sensitive connector write on its own: it holds a pending
 * action that only the requester can confirm or cancel until `expiresAt`. These
 * pure helpers decide what a card shows; the component only renders it.
 */

export type ActionStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed' | 'expired'

/** What the card shows for one action. */
export type ActionCardState =
  /** Confirm / Cancel buttons (requester, still pending, not expired). */
  | { kind: 'actionable' }
  /** Pending, but someone else must decide. */
  | { kind: 'waiting'; requesterId?: string }
  | { kind: 'confirmed' }
  | { kind: 'cancelled' }
  | { kind: 'failed' }
  | { kind: 'expired' }
  /** Resolved elsewhere (another tab / device) and the outcome hasn't arrived yet. */
  | { kind: 'handled' }

/** Local outcome recorded by this client before `MESSAGE_UPDATED` confirms it. */
export type LocalActionOutcome = ActionStatus | 'handled'

const RESOLVED = new Set(['confirmed', 'cancelled', 'failed', 'expired'])

/** `expiresAt` as epoch ms, or null when absent / unparseable. */
export function expiryMs(action: Pick<AiPendingAction, 'expiresAt'>): number | null {
  if (!action.expiresAt) return null
  const ms = Date.parse(action.expiresAt)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Card state. A server status other than `pending` always wins (it is the truth
 * broadcast by `MESSAGE_UPDATED`); while the server still says `pending`, this
 * client's own outcome (confirm/cancel just answered) is shown instead.
 */
export function actionCardState(
  action: AiPendingAction,
  me: string | undefined,
  now: number,
  local?: LocalActionOutcome | null,
): ActionCardState {
  const server = action.status ?? 'pending'
  if (RESOLVED.has(server)) return { kind: server as Exclude<ActionStatus, 'pending'> }
  if (server !== 'pending') return { kind: 'expired' }
  if (local && local !== 'pending') return { kind: local }
  const expires = expiryMs(action)
  if (expires !== null && now >= expires) return { kind: 'expired' }
  if (me && action.requesterId === me) return { kind: 'actionable' }
  return { kind: 'waiting', requesterId: action.requesterId }
}

/** Status of a confirm/cancel response body (`{ status }`); anything odd → null. */
export function responseStatus(body: unknown): ActionStatus | null {
  const status = (body as { status?: unknown } | null)?.status
  return status === 'confirmed' || status === 'cancelled' || status === 'failed' ? status : null
}

export interface ActionErrorOutcome {
  /** `chat.*` key of the toast. */
  key: string
  /** Local outcome to show until the server's status arrives (null = keep the buttons). */
  outcome: LocalActionOutcome | null
}

/** Map a failed confirm/cancel to a localized message + what the card shows next. */
export function actionErrorOutcome(err: unknown): ActionErrorOutcome {
  if (!axios.isAxiosError(err)) return { key: 'aiActionErrGeneric', outcome: null }
  if (!err.response) return { key: 'errNetwork', outcome: null }
  const code = (err.response.data as { code?: unknown } | undefined)?.code
  const status = err.response.status
  if (code === 'ACTION_EXPIRED' || status === 410) {
    return { key: 'aiActionErrExpired', outcome: 'expired' }
  }
  if (code === 'ACTION_NOT_FOUND' || status === 404) {
    return { key: 'aiActionErrNotFound', outcome: 'expired' }
  }
  if (code === 'ACTION_ALREADY_RESOLVED' || status === 409) {
    return { key: 'aiActionErrAlreadyResolved', outcome: 'handled' }
  }
  if (code === 'ACTION_NOT_OWNER' || status === 403) {
    return { key: 'aiActionErrNotOwner', outcome: null }
  }
  return { key: 'aiActionErrGeneric', outcome: null }
}

/** A copy of [messages] where the action [actionId] has [status] (others untouched). */
export function withActionStatus(message: Message, actionId: string, status: ActionStatus): Message {
  if (!message.pendingActions?.some((a) => a.id === actionId)) return message
  return {
    ...message,
    pendingActions: message.pendingActions.map((a) => (a.id === actionId ? { ...a, status } : a)),
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

export interface ActionSummaryLine {
  /** `chat.*` label key ("To", "Subject", "Title", "When"). */
  labelKey: string
  value: string
}

export interface ActionSummaryView {
  /** `chat.*` key of the headline. */
  titleKey: string
  titleValues?: Record<string, string>
  lines: ActionSummaryLine[]
}

const TITLE_KEYS: Record<string, string> = {
  send_email: 'aiActionSendEmail',
  draft_email: 'aiActionDraftEmail',
  create_event: 'aiActionCreateEvent',
  update_event: 'aiActionUpdateEvent',
  create_page: 'aiActionCreatePage',
  update_page: 'aiActionUpdatePage',
}

function text(value: unknown, max = 200): string | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.replace(/\s+/g, ' ').trim()
  if (!v) return undefined
  return v.length > max ? `${v.slice(0, max - 1)}…` : v
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Localized date / date-time of an event bound; unparseable values are shown as given. */
export function formatActionTime(value: string, locale: string, timeZone?: string): string {
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(Date.UTC(y!, m! - 1, d!)),
    )
  }
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(
    new Date(ms),
  )
}

/**
 * Headline + detail rows of an action from its `summary` (never the raw tool
 * name). Unknown kinds fall back to the generic "Run an action" headline.
 */
export function actionSummaryView(
  summary: Record<string, unknown> | undefined,
  locale: string,
  timeZone?: string,
): ActionSummaryView {
  const kind = typeof summary?.kind === 'string' ? summary.kind : 'generic'
  const lines: ActionSummaryLine[] = []
  const push = (labelKey: string, value: unknown) => {
    const v = text(value)
    if (v) lines.push({ labelKey, value: v })
  }
  if (kind === 'send_email' || kind === 'draft_email') {
    push('aiActionFieldTo', summary?.to)
    push('aiActionFieldSubject', summary?.subject)
  } else if (kind === 'create_event' || kind === 'update_event') {
    push('aiActionFieldTitle', summary?.title)
    const start = text(summary?.start, 64)
    const end = text(summary?.end, 64)
    if (start) {
      const from = formatActionTime(start, locale, timeZone)
      const value = end ? `${from} – ${formatActionTime(end, locale, timeZone)}` : from
      lines.push({ labelKey: 'aiActionFieldWhen', value })
    }
  } else if (kind === 'create_page' || kind === 'update_page') {
    push('aiActionFieldTitle', summary?.title)
  }
  const titleKey = TITLE_KEYS[kind]
  if (titleKey) return { titleKey, lines }
  const tool = text(summary?.tool, 60)
  return tool
    ? { titleKey: 'aiActionGenericNamed', titleValues: { tool }, lines }
    : { titleKey: 'aiActionGeneric', lines }
}
