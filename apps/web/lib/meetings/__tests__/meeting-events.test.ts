import { describe, it, expect } from 'vitest'
import { parseMeetingEvent } from '@/lib/meetings/meeting-events'

const j = (v: unknown) => JSON.stringify(v)

describe('parseMeetingEvent', () => {
  it('rejects junk, unknown events and missing meeting ids', () => {
    expect(parseMeetingEvent('not json')).toBeNull()
    expect(parseMeetingEvent(j(['meet.ended']))).toBeNull()
    expect(parseMeetingEvent(j({ event: 'meet.unknown', meetingId: 'm1' }))).toBeNull()
    expect(parseMeetingEvent(j({ event: 'meet.ended' }))).toBeNull()
  })

  it('parses a roster with current roles and drops broken rows', () => {
    const e = parseMeetingEvent(j({
      event: 'meet.roster', meetingId: 'm1',
      participants: [
        { userId: 'a', displayName: 'An', role: 'cohost', joinedAt: '2026-10-08T02:00:00Z' },
        { userId: 'b', role: 'superuser', joinedAt: '2026-10-08T02:01:00Z' },
        { displayName: 'no id' },
      ],
    }))
    expect(e).toEqual({
      event: 'meet.roster', meetingId: 'm1',
      participants: [
        { userId: 'a', displayName: 'An', role: 'cohost', joinedAt: '2026-10-08T02:00:00Z' },
        { userId: 'b', role: 'attendee', joinedAt: '2026-10-08T02:01:00Z' },
      ],
    })
  })

  it('needs all five settings', () => {
    const settings = { waitingRoom: true, muteOnEntry: false, allowAttendeeScreenShare: false,
      attendeesCanEditNotes: true, locked: false }
    expect(parseMeetingEvent(j({ event: 'meet.settings', meetingId: 'm1', settings })))
      .toEqual({ event: 'meet.settings', meetingId: 'm1', settings })
    expect(parseMeetingEvent(j({ event: 'meet.settings', meetingId: 'm1', settings: { locked: true } })))
      .toBeNull()
  })

  it('keeps hands in server order', () => {
    const e = parseMeetingEvent(j({ event: 'meet.hands', meetingId: 'm1', hands: [
      { userId: 'c', displayName: 'Chi', raisedAt: '2026-10-08T02:06:00Z' },
      { userId: 'a', raisedAt: '2026-10-08T02:07:00Z' },
    ] }))
    expect(e?.event === 'meet.hands' && e.hands.map((h) => h.userId)).toEqual(['c', 'a'])
  })

  it('parses chat with an echoed client id', () => {
    const message = { id: 'x1', sender: { userId: 'a', displayName: 'An' }, content: 'hi', createdAt: '2026-10-08T02:05:11Z' }
    expect(parseMeetingEvent(j({ event: 'meet.chat', meetingId: 'm1', clientId: 'c-1', message })))
      .toEqual({ event: 'meet.chat', meetingId: 'm1', clientId: 'c-1', message })
    expect(parseMeetingEvent(j({ event: 'meet.chat', meetingId: 'm1', message: { id: 'x1' } }))).toBeNull()
  })

  it('parses note updates without content', () => {
    expect(parseMeetingEvent(j({ event: 'meet.notes.updated', meetingId: 'm1', version: 8,
      updatedBy: { userId: 'u2', displayName: 'Minh' } })))
      .toEqual({ event: 'meet.notes.updated', meetingId: 'm1', version: 8,
        updatedBy: { userId: 'u2', displayName: 'Minh' } })
    expect(parseMeetingEvent(j({ event: 'meet.notes.updated', meetingId: 'm1', version: '8' }))).toBeNull()
  })

  it('parses the personal queue events', () => {
    expect(parseMeetingEvent(j({ event: 'meet.lobby', meetingId: 'm1', waiting: [{ userId: 'g', displayName: 'Guest' }, {}] })))
      .toEqual({ event: 'meet.lobby', meetingId: 'm1', waiting: [{ userId: 'g', displayName: 'Guest' }] })
    for (const event of ['meet.admitted', 'meet.denied', 'meet.removed', 'meet.cancelled', 'meet.ended']) {
      expect(parseMeetingEvent(j({ event, meetingId: 'm1' }))).toEqual({ event, meetingId: 'm1' })
    }
    expect(parseMeetingEvent(j({ event: 'meet.muted', meetingId: 'm1', actor: { userId: 'h', displayName: 'Lan' } })))
      .toEqual({ event: 'meet.muted', meetingId: 'm1', actor: { userId: 'h', displayName: 'Lan' } })
  })

  it('parses meet.error and drops an unknown action and non-scalar params', () => {
    expect(parseMeetingEvent(j({ event: 'meet.error', meetingId: 'm1', action: 'NUKE', clientId: 'c-7',
      errorCode: 'MEETING_INVALID', params: { field: 'content', max: 2000, extra: { a: 1 } } })))
      .toEqual({ event: 'meet.error', meetingId: 'm1', clientId: 'c-7', errorCode: 'MEETING_INVALID',
        params: { field: 'content', max: 2000 } })
    expect(parseMeetingEvent(j({ event: 'meet.error', errorCode: 'RATE_LIMITED' })))
      .toEqual({ event: 'meet.error', errorCode: 'RATE_LIMITED' })
    expect(parseMeetingEvent(j({ event: 'meet.error', meetingId: 'm1', action: 'LOCK', errorCode: 'MEETINGS_UNAVAILABLE' })))
      .toEqual({ event: 'meet.error', meetingId: 'm1', action: 'LOCK', errorCode: 'MEETINGS_UNAVAILABLE' })
    expect(parseMeetingEvent(j({ event: 'meet.error', meetingId: 'm1' }))).toBeNull()
  })

  it('parses invitations and reminders (code required)', () => {
    expect(parseMeetingEvent(j({ event: 'meet.invited', meetingId: 'm1', code: 'abc-defg-hjk', title: 'Sync',
      hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: 'Lan', scheduledStart: '2026-10-08T02:00:00Z' })))
      .toEqual({ event: 'meet.invited', meetingId: 'm1', code: 'abc-defg-hjk', title: 'Sync',
        hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: 'Lan', scheduledStart: '2026-10-08T02:00:00Z' })
    expect(parseMeetingEvent(j({ event: 'meet.starting', meetingId: 'm1', code: 'abc-defg-hjk' })))
      .toEqual({ event: 'meet.starting', meetingId: 'm1', code: 'abc-defg-hjk' })
    expect(parseMeetingEvent(j({ event: 'meet.invited', meetingId: 'm1' }))).toBeNull()
  })

  it('keeps the title and code of a cancellation when the server sends them (gap B3)', () => {
    expect(parseMeetingEvent(j({ event: 'meet.cancelled', meetingId: 'm1', title: 'Sync', code: 'abc-defg-hjk' })))
      .toEqual({ event: 'meet.cancelled', meetingId: 'm1', title: 'Sync', code: 'abc-defg-hjk' })
    expect(parseMeetingEvent(j({ event: 'meet.cancelled', meetingId: 'm1', title: '', code: 7 })))
      .toEqual({ event: 'meet.cancelled', meetingId: 'm1' })
  })
})
