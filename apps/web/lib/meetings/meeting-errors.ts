import axios from 'axios'
import { parseChatError, type ChatErrorInfo } from '@/lib/api/chat-errors'
import { MEETING_LIMITS, type MeetingNote, type MeetingPerson } from '@/lib/api/meeting-types'

/**
 * Meeting errors → keys of the `meeting` i18n namespace.
 *
 * chat-service puts `{ code, params }` at the top level of every error body (REST) and in
 * `meet.error` frames (STOMP). The English `message`/`error` text next to it is diagnostics
 * and never reaches the UI (.claude/rules/no-raw-system-data-in-ui.md): unknown failures map
 * to `errGeneric`, never to `err.message`.
 */

export type Translate = (key: string, values?: Record<string, string | number>) => string
export type MeetingErrorInfo = ChatErrorInfo
/** Which `content` an invalid-field error is about. */
export type MeetingErrorContext = 'general' | 'chat' | 'note'
export interface MessageKey {
  key: string
  values?: Record<string, string | number>
}

/** Same parsing as chat-service errors (top-level `{code, params}`). */
export const parseMeetingError: (err: unknown) => MeetingErrorInfo = parseChatError

const CODE_KEYS: Record<string, string> = {
  MEETING_NOT_FOUND: 'errNotFound',
  MEETING_FORBIDDEN: 'errForbidden',
  MEETING_CREATE_FORBIDDEN: 'errCreateForbidden',
  MEETING_DEPARTMENT_FORBIDDEN: 'errDepartmentForbidden',
  MEETING_REMOVED: 'errRemoved',
  MEETING_LOCKED: 'errLocked',
  MEETING_ENDED: 'errEnded',
  MEETING_NOT_CANCELLABLE: 'errNotCancellable',
  MEETINGS_UNAVAILABLE: 'errUnavailable',
  MEETING_NOTES_READ_ONLY: 'errNotesReadOnly',
  MEETING_NOTE_CONFLICT: 'errNoteConflict',
  RATE_LIMITED: 'errRateLimited',
}

/** `params.max` when it is a positive number, else the contract limit. */
function maxOr(params: Record<string, string | number> | undefined, fallback: number): number {
  const max = Number(params?.max)
  return Number.isFinite(max) && max > 0 ? max : fallback
}

function invalidFieldKey(
  params: Record<string, string | number> | undefined,
  context: MeetingErrorContext,
): MessageKey {
  switch (params?.field) {
    case 'title':
      return { key: 'valTitleTooLong', values: { max: maxOr(params, MEETING_LIMITS.title) } }
    case 'description':
      return {
        key: 'valDescriptionTooLong',
        values: { max: maxOr(params, MEETING_LIMITS.description) },
      }
    case 'inviteeIds':
      return maxOr(params, 0) > 0
        ? { key: 'valTooManyInvitees', values: { max: maxOr(params, 0) } }
        : { key: 'errInviteeInvalid' }
    case 'departmentId':
      return { key: 'errDepartmentInvalid' }
    case 'scheduledStart':
      return { key: 'errStartInvalid' }
    case 'scheduledEnd':
      return { key: 'errEndInvalid' }
    case 'targetId':
      return { key: 'errTargetUnavailable' }
    case 'content':
      return context === 'note'
        ? { key: 'errNoteTooLong', values: { max: maxOr(params, MEETING_LIMITS.note) } }
        : { key: 'errChatTooLong', values: { max: maxOr(params, MEETING_LIMITS.chat) } }
    default:
      return { key: 'errInvalid' }
  }
}

export function meetingErrorKey(
  info: MeetingErrorInfo,
  context: MeetingErrorContext = 'general',
): MessageKey {
  if (info.code === 'MEETING_FULL') {
    return { key: 'errFull', values: { max: maxOr(info.params, MEETING_LIMITS.participants) } }
  }
  if (info.code === 'MEETING_INVALID') return invalidFieldKey(info.params, context)
  if (info.code && CODE_KEYS[info.code]) return { key: CODE_KEYS[info.code] }
  if (info.status === 429) return { key: 'errRateLimited' }
  if (info.status === 503) return { key: 'errUnavailable' }
  if (info.network) return { key: 'errNetwork' }
  return { key: 'errGeneric' }
}

/** Localized text for any thrown error (`t` = the `meeting` namespace). */
export function meetingErrorMessage(
  err: unknown,
  t: Translate,
  context: MeetingErrorContext = 'general',
): string {
  const { key, values } = meetingErrorKey(parseMeetingError(err), context)
  return t(key, values)
}

/** `meet.error` (errorCode + params) → the same mapping as REST errors. */
export function meetingEventErrorKey(
  errorCode: string,
  params?: Record<string, string | number>,
  context: MeetingErrorContext = 'general',
): MessageKey {
  return meetingErrorKey({ code: errorCode, params }, context)
}

function person(v: unknown): MeetingPerson | undefined {
  if (!v || typeof v !== 'object') return undefined
  const p = v as Record<string, unknown>
  if (typeof p.userId !== 'string') return undefined
  return {
    userId: p.userId,
    ...(typeof p.displayName === 'string' && p.displayName ? { displayName: p.displayName } : {}),
    ...(typeof p.avatarUrl === 'string' && p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}),
  }
}

/** The `latest` note of a 409 MEETING_NOTE_CONFLICT, else null (validated shape). */
export function noteConflictLatest(err: unknown): MeetingNote | null {
  if (!axios.isAxiosError(err) || err.response?.status !== 409) return null
  const data = err.response.data as { code?: unknown; latest?: unknown } | undefined
  if (data?.code !== 'MEETING_NOTE_CONFLICT') return null
  const latest = data.latest
  if (!latest || typeof latest !== 'object') return null
  const l = latest as Record<string, unknown>
  if (typeof l.content !== 'string' || typeof l.version !== 'number') return null
  if (l.scope !== 'shared' && l.scope !== 'private') return null
  const updatedBy = person(l.updatedBy)
  return {
    scope: l.scope,
    content: l.content,
    version: l.version,
    ...(updatedBy ? { updatedBy } : {}),
    ...(typeof l.updatedAt === 'string' ? { updatedAt: l.updatedAt } : {}),
  }
}
