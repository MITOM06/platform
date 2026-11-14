import { describe, it, expect } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'
import { noteConflictLatest } from '@/lib/meetings/meeting-errors'
import { parseMeetingEvent } from '@/lib/meetings/meeting-events'

const err409 = (data: unknown, status = 409) => {
  const e = new AxiosError('x')
  e.response = { status, data } as AxiosResponse
  return e
}

describe('noteConflictLatest', () => {
  it('only a 409 MEETING_NOTE_CONFLICT with a well-formed latest note counts', () => {
    expect(noteConflictLatest(new Error('x'))).toBeNull()
    expect(noteConflictLatest(err409({ code: 'MEETING_NOTE_CONFLICT' }, 400))).toBeNull()
    expect(noteConflictLatest(err409({ code: 'OTHER' }))).toBeNull()
    expect(noteConflictLatest(err409({ code: 'MEETING_NOTE_CONFLICT' }))).toBeNull()
    expect(noteConflictLatest(err409({ code: 'MEETING_NOTE_CONFLICT', latest: 'str' }))).toBeNull()
    expect(noteConflictLatest(err409({ code: 'MEETING_NOTE_CONFLICT', latest: { content: 1, version: 2, scope: 'shared' } }))).toBeNull()
    expect(noteConflictLatest(err409({ code: 'MEETING_NOTE_CONFLICT', latest: { content: 'a', version: 2, scope: 'team' } }))).toBeNull()
  })

  it('keeps updatedBy / updatedAt only when valid', () => {
    expect(noteConflictLatest(err409({
      code: 'MEETING_NOTE_CONFLICT',
      latest: { content: 'a', version: 2, scope: 'private', updatedBy: 'nope' },
    }))).toEqual({ scope: 'private', content: 'a', version: 2 })
    expect(noteConflictLatest(err409({
      code: 'MEETING_NOTE_CONFLICT',
      latest: { content: 'a', version: 3, scope: 'shared', updatedBy: { userId: 'u1', displayName: 'Ann' }, updatedAt: '2026-01-01T00:00:00Z' },
    }))).toMatchObject({ version: 3, updatedBy: { userId: 'u1' }, updatedAt: '2026-01-01T00:00:00Z' })
    expect(noteConflictLatest(err409({
      code: 'MEETING_NOTE_CONFLICT',
      latest: { content: 'a', version: 3, scope: 'shared', updatedBy: { userId: 7 } },
    }))).toEqual({ scope: 'shared', content: 'a', version: 3 })
  })
})

describe('parseMeetingEvent edge payloads', () => {
  const p = (o: object) => parseMeetingEvent(JSON.stringify({ meetingId: 'm1', ...o }))

  it('non-array rows become empty; rows without a userId are skipped', () => {
    expect(p({ event: 'meet.hands', hands: 'x' })).toEqual({ event: 'meet.hands', meetingId: 'm1', hands: [] })
    expect(p({ event: 'meet.hands', hands: [null, { userId: '' }, { userId: 'u1', raisedAt: 't' }] })).toEqual({
      event: 'meet.hands', meetingId: 'm1', hands: [{ userId: 'u1', raisedAt: 't' }],
    })
  })

  it('chat messages need an object with sender, id, content and createdAt', () => {
    expect(p({ event: 'meet.chat', message: 'x' })).toBeNull()
    expect(p({ event: 'meet.chat', message: { id: 'a', content: 'b', sender: { userId: 'u' } } })).toBeNull()
    expect(p({ event: 'meet.chat', message: { id: 1, content: 'b', createdAt: 't', sender: { userId: 'u' } } })).toBeNull()
  })
})
