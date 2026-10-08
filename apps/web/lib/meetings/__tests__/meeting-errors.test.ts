import { describe, it, expect } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import {
  meetingErrorKey,
  meetingErrorMessage,
  meetingEventErrorKey,
  noteConflictLatest,
  parseMeetingError,
} from '@/lib/meetings/meeting-errors'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key

function httpError(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError('boom', 'ERR', undefined, undefined, response as AxiosResponse)
}

describe('meetingErrorKey', () => {
  it.each([
    ['MEETING_NOT_FOUND', 'errNotFound'],
    ['MEETING_FORBIDDEN', 'errForbidden'],
    ['MEETING_CREATE_FORBIDDEN', 'errCreateForbidden'],
    ['MEETING_DEPARTMENT_FORBIDDEN', 'errDepartmentForbidden'],
    ['MEETING_REMOVED', 'errRemoved'],
    ['MEETING_LOCKED', 'errLocked'],
    ['MEETING_ENDED', 'errEnded'],
    ['MEETING_NOT_CANCELLABLE', 'errNotCancellable'],
    ['MEETINGS_UNAVAILABLE', 'errUnavailable'],
    ['MEETING_NOTES_READ_ONLY', 'errNotesReadOnly'],
    ['MEETING_NOTE_CONFLICT', 'errNoteConflict'],
    ['RATE_LIMITED', 'errRateLimited'],
  ])('%s → %s', (code, key) => {
    expect(meetingErrorKey({ code }).key).toBe(key)
  })

  it('fills the room size into MEETING_FULL', () => {
    expect(meetingErrorKey({ code: 'MEETING_FULL' })).toEqual({ key: 'errFull', values: { max: 25 } })
  })

  it('maps MEETING_INVALID by field, using the server max when present', () => {
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'title', max: 120 } }))
      .toEqual({ key: 'valTitleTooLong', values: { max: 120 } })
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'description' } }))
      .toEqual({ key: 'valDescriptionTooLong', values: { max: 2000 } })
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'inviteeIds', max: 100 } }))
      .toEqual({ key: 'valTooManyInvitees', values: { max: 100 } })
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'inviteeIds' } }).key)
      .toBe('errInviteeInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'departmentId' } }).key)
      .toBe('errDepartmentInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'scheduledStart' } }).key)
      .toBe('errStartInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'scheduledEnd' } }).key)
      .toBe('errEndInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'targetId' } }).key)
      .toBe('errTargetUnavailable')
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'size' } }).key).toBe('errInvalid')
    expect(meetingErrorKey({ code: 'MEETING_INVALID' }).key).toBe('errInvalid')
  })

  it('tells chat content from note content', () => {
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'content', max: 2000 } }, 'chat'))
      .toEqual({ key: 'errChatTooLong', values: { max: 2000 } })
    expect(meetingErrorKey({ code: 'MEETING_INVALID', params: { field: 'content' } }, 'note'))
      .toEqual({ key: 'errNoteTooLong', values: { max: 50000 } })
  })

  it('falls back on status, network and the generic key — never raw text', () => {
    expect(meetingErrorKey({ status: 429 }).key).toBe('errRateLimited')
    expect(meetingErrorKey({ status: 503 }).key).toBe('errUnavailable')
    expect(meetingErrorKey({ network: true }).key).toBe('errNetwork')
    expect(meetingErrorKey({ status: 500, code: 'SOMETHING_NEW' }).key).toBe('errGeneric')
    expect(meetingErrorKey({}).key).toBe('errGeneric')
  })
})

describe('meetingErrorMessage / parseMeetingError', () => {
  it('reads the top-level code of an axios error', () => {
    const err = httpError(403, { error: 'Forbidden', code: 'MEETING_LOCKED', statusCode: 403 })
    expect(parseMeetingError(err)).toEqual({ status: 403, code: 'MEETING_LOCKED', params: undefined })
    expect(meetingErrorMessage(err, t)).toBe('errLocked')
  })

  it('never surfaces exception text', () => {
    expect(meetingErrorMessage(new Error('Cannot read properties of undefined'), t)).toBe('errGeneric')
  })
})

describe('meetingEventErrorKey', () => {
  it('maps meet.error codes with their params', () => {
    expect(meetingEventErrorKey('RATE_LIMITED').key).toBe('errRateLimited')
    expect(meetingEventErrorKey('MEETING_INVALID', { field: 'content', max: 2000 }, 'chat'))
      .toEqual({ key: 'errChatTooLong', values: { max: 2000 } })
    expect(meetingEventErrorKey('MEETINGS_UNAVAILABLE').key).toBe('errUnavailable')
  })
})

describe('noteConflictLatest', () => {
  const latest = { scope: 'shared', content: 'theirs', version: 8, updatedBy: { userId: 'u2', displayName: 'Minh' } }

  it('returns the latest note of a 409 conflict', () => {
    const err = httpError(409, { code: 'MEETING_NOTE_CONFLICT', statusCode: 409, latest })
    expect(noteConflictLatest(err)).toEqual(latest)
  })

  it('ignores other errors and malformed bodies', () => {
    expect(noteConflictLatest(httpError(409, { code: 'MEETING_ENDED' }))).toBeNull()
    expect(noteConflictLatest(httpError(409, { code: 'MEETING_NOTE_CONFLICT', latest: { content: 1 } }))).toBeNull()
    expect(noteConflictLatest(new Error('x'))).toBeNull()
  })
})
