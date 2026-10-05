import type { AiPendingAction, AiStreamState } from '@/lib/api/types'

/**
 * Routing of AI streaming events to their reply bubble (HANDOFF §5.2).
 *
 * Every `AI_STREAM_*` / `AI_TOOL_CALL` / `AI_ACTION_PENDING` frame carries the
 * `replyId` of the reply it belongs to and the `requesterId` of the member who
 * asked. With one shared stream bubble, two concurrent @AI requests in a group
 * concatenated into one text and one user's error ended the other's stream.
 * Each reply now gets its own entry; the "thinking" placeholder created on send
 * (before any id is known) is adopted by the first event of MY request.
 *
 * Pure functions — the hook (`use-ai-streams`) owns timers and React state.
 */

/** Live state of one AI reply bubble. `key` is stable for the bubble's lifetime. */
export interface AiStreamEntry extends AiStreamState {
  key: string
  /** Known once the first event of the reply arrives (absent on the send placeholder). */
  replyId?: string
  /** Who asked — only they see the reply's error toast. */
  requesterId?: string
  /** Sensitive actions held for confirmation while the reply is still streaming (F2). */
  pendingActions: AiPendingAction[]
}

/** Key of the placeholder created when I send a message that triggers the AI. */
export const LOCAL_STREAM_KEY = 'local'
/** Key used for events of a server that does not send `replyId` yet. */
export const LEGACY_STREAM_KEY = 'legacy'

/** The subset of an AI stream frame the router reads. */
export interface AiStreamEvent {
  type:
    | 'AI_STREAM_CHUNK'
    | 'AI_TOOL_CALL'
    | 'AI_ACTION_PENDING'
    | 'AI_STREAM_DONE'
    | 'AI_STREAM_ERROR'
  replyId?: string
  requesterId?: string
  chunk?: string
  toolName?: string
  sensitive?: boolean
  action?: AiPendingAction
  code?: string
}

export interface AiStreamResult {
  streams: AiStreamEntry[]
  /** Entry the event landed on (to re-arm its watchdog); null when nothing is live. */
  touchedKey: string | null
  /** Entries removed by this event (to clear their watchdogs). */
  removedKeys: string[]
  /**
   * `AI_STREAM_ERROR` only: show the error toast to this client. True for the
   * requester (or when the server names none — legacy frames), false for everyone
   * else in the conversation, who just sees the bubble end.
   */
  notifyError: boolean
}

function emptyEntry(key: string, replyId?: string, requesterId?: string): AiStreamEntry {
  return {
    key,
    replyId,
    requesterId,
    content: '',
    thinking: true,
    activeTools: [],
    sensitiveTools: [],
    pendingActions: [],
  }
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Add (or keep) my "thinking" placeholder for a message I just sent. */
export function startLocalStream(streams: AiStreamEntry[], me?: string): AiStreamEntry[] {
  if (streams.some((s) => s.key === LOCAL_STREAM_KEY)) return streams
  return [...streams, emptyEntry(LOCAL_STREAM_KEY, undefined, me)]
}

/** Drop my placeholder (the send failed, so no reply is coming). */
export function dropLocalStream(streams: AiStreamEntry[]): AiStreamEntry[] {
  return streams.filter((s) => s.key !== LOCAL_STREAM_KEY)
}

/**
 * Index of the entry an event belongs to, or -1 when it starts a new bubble.
 * Order: exact `replyId` → my unadopted placeholder (event of my own request, or a
 * frame that names no requester) → legacy single-stream entry for id-less frames.
 */
export function findStreamIndex(
  streams: AiStreamEntry[],
  event: Pick<AiStreamEvent, 'replyId' | 'requesterId'>,
  me?: string,
): number {
  const replyId = nonEmpty(event.replyId)
  const requesterId = nonEmpty(event.requesterId)
  if (replyId) {
    const exact = streams.findIndex((s) => s.replyId === replyId)
    if (exact !== -1) return exact
  }
  const mine = !requesterId || (!!me && requesterId === me)
  if (mine) {
    const local = streams.findIndex((s) => s.key === LOCAL_STREAM_KEY && !s.replyId)
    if (local !== -1) return local
  }
  if (!replyId) return streams.findIndex((s) => s.key === LEGACY_STREAM_KEY)
  return -1
}

function patchEntry(entry: AiStreamEntry, event: AiStreamEvent): AiStreamEntry {
  const replyId = entry.replyId ?? nonEmpty(event.replyId)
  const requesterId = nonEmpty(event.requesterId) ?? entry.requesterId
  const base = { ...entry, replyId, requesterId }
  switch (event.type) {
    case 'AI_STREAM_CHUNK':
      return { ...base, content: base.content + String(event.chunk ?? ''), thinking: false }
    case 'AI_TOOL_CALL': {
      const tool = String(event.toolName ?? '')
      if (!tool) return base
      return {
        ...base,
        activeTools: base.activeTools.includes(tool) ? base.activeTools : [...base.activeTools, tool],
        sensitiveTools:
          event.sensitive === true && !base.sensitiveTools.includes(tool)
            ? [...base.sensitiveTools, tool]
            : base.sensitiveTools,
      }
    }
    case 'AI_ACTION_PENDING': {
      const action = event.action
      if (!action || typeof action.id !== 'string' || !action.id) return base
      const withRequester: AiPendingAction = {
        ...action,
        requesterId: action.requesterId ?? requesterId,
      }
      const exists = base.pendingActions.some((a) => a.id === action.id)
      return {
        ...base,
        pendingActions: exists
          ? base.pendingActions.map((a) => (a.id === action.id ? { ...a, ...withRequester } : a))
          : [...base.pendingActions, withRequester],
      }
    }
    default:
      return base
  }
}

/** Apply one AI stream frame. Unknown routing never throws — it starts a new bubble. */
export function applyAiStreamEvent(
  streams: AiStreamEntry[],
  event: AiStreamEvent,
  me?: string,
): AiStreamResult {
  const idx = findStreamIndex(streams, event, me)
  const requesterId = nonEmpty(event.requesterId)

  if (event.type === 'AI_STREAM_DONE' || event.type === 'AI_STREAM_ERROR') {
    const notifyError =
      event.type === 'AI_STREAM_ERROR' && (requesterId ? requesterId === me : true)
    if (idx === -1) {
      return { streams, touchedKey: null, removedKeys: [], notifyError }
    }
    const removed = streams[idx]!
    return {
      streams: streams.filter((_, i) => i !== idx),
      touchedKey: null,
      removedKeys: [removed.key],
      notifyError,
    }
  }

  if (idx === -1) {
    const replyId = nonEmpty(event.replyId)
    const key = replyId ?? LEGACY_STREAM_KEY
    const entry = patchEntry(emptyEntry(key, replyId, requesterId), event)
    return { streams: [...streams, entry], touchedKey: key, removedKeys: [], notifyError: false }
  }

  const entry = patchEntry(streams[idx]!, event)
  return {
    streams: streams.map((s, i) => (i === idx ? entry : s)),
    touchedKey: entry.key,
    removedKeys: [],
    notifyError: false,
  }
}

/**
 * The persisted AI message of reply [replyId] arrived (`Message.aiReplyId`): its
 * streaming bubble is replaced by the real message, exactly — no guessing.
 */
export function finishReplyStream(
  streams: AiStreamEntry[],
  replyId: string | undefined | null,
): { streams: AiStreamEntry[]; removedKeys: string[] } {
  if (!replyId) return { streams, removedKeys: [] }
  const removed = streams.filter((s) => s.replyId === replyId)
  if (removed.length === 0) return { streams, removedKeys: [] }
  return {
    streams: streams.filter((s) => s.replyId !== replyId),
    removedKeys: removed.map((s) => s.key),
  }
}

/** Localized `chat.*` key of an `AI_STREAM_ERROR` code — never the raw server text. */
export function aiStreamErrorKey(code: string | undefined): string {
  switch (code) {
    case 'AI_QUOTA_EXCEEDED':
      return 'aiQuotaExceeded'
    case 'AI_RATE_LIMITED':
      return 'aiRateLimited'
    case 'AI_STREAM_INTERRUPTED':
      return 'aiStreamInterrupted'
    case 'AI_UNAVAILABLE':
      return 'aiUnavailable'
    case 'AI_EMPTY_RESPONSE':
      return 'aiEmptyResponse'
    default:
      return 'aiError'
  }
}
