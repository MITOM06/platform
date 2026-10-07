import { describe, it, expect } from 'vitest'
import type { Meeting, MeetingSettings } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import {
  canEditSharedNote, canSeeRecords, canShareScreen, detailActions, isManager, myRoomRole,
  personActions, prejoinIntent, roomControls,
} from '@/lib/meetings/permissions'

const S: MeetingSettings = DEFAULT_MEETING_SETTINGS
function meeting(over: Partial<Meeting> = {}): Meeting {
  return { id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status: 'SCHEDULED', settings: S,
    viewerRole: 'host', createdAt: '2026-10-07T00:00:00Z', ...over }
}

describe('detailActions', () => {
  it('host of a scheduled meeting nobody joined: join, copy, edit, cancel', () => {
    expect(detailActions(meeting(), true)).toEqual({ join: true, copyLink: true, edit: true, cancel: true, end: false, meetAgain: false })
  })

  it('cannot cancel once someone joined or when LIVE; managers can end a LIVE meeting', () => {
    const joined = meeting({ attendance: [{ userId: 'a', role: 'attendee', joinedAt: 't' }] })
    expect(detailActions(joined, true).cancel).toBe(false)
    expect(detailActions(meeting({ status: 'LIVE', viewerRole: 'cohost' }), false))
      .toMatchObject({ join: true, edit: true, cancel: false, end: true })
  })

  it('invitees and guests only join and copy', () => {
    for (const viewerRole of ['invited', 'guest'] as const) {
      expect(detailActions(meeting({ status: 'LIVE', viewerRole }), true))
        .toEqual({ join: true, copyLink: true, edit: false, cancel: false, end: false, meetAgain: false })
    }
  })

  it('an ended meeting offers "meet again" to its hosts who can still host', () => {
    expect(detailActions(meeting({ status: 'ENDED' }), true))
      .toEqual({ join: false, copyLink: false, edit: false, cancel: false, end: false, meetAgain: true })
    expect(detailActions(meeting({ status: 'ENDED' }), false).meetAgain).toBe(false)
    expect(detailActions(meeting({ status: 'ENDED', viewerRole: 'invited' }), true).meetAgain).toBe(false)
  })
})

describe('notes and records', () => {
  it('guests see no records', () => {
    expect(canSeeRecords(meeting({ viewerRole: 'guest' }))).toBe(false)
    expect(canSeeRecords(meeting({ viewerRole: 'invited' }))).toBe(true)
  })

  it('managers always edit shared notes, others only when allowed', () => {
    const closed = { ...S, attendeesCanEditNotes: false }
    expect(canEditSharedNote('host', closed)).toBe(true)
    expect(canEditSharedNote('cohost', closed)).toBe(true)
    expect(canEditSharedNote('attendee', closed)).toBe(false)
    expect(canEditSharedNote('invited', S)).toBe(true)
    expect(canEditSharedNote('guest', closed)).toBe(false)
  })
})

describe('prejoinIntent', () => {
  it('invited people join, strangers ask or are locked out', () => {
    expect(prejoinIntent(meeting({ viewerRole: 'invited' }))).toBe('join')
    expect(prejoinIntent(meeting({ viewerRole: 'cohost', settings: { ...S, locked: true } }))).toBe('join')
    expect(prejoinIntent(meeting({ viewerRole: 'guest' }))).toBe('ask')
    expect(prejoinIntent(meeting({ viewerRole: 'guest', settings: { ...S, waitingRoom: false } }))).toBe('join')
    expect(prejoinIntent(meeting({ viewerRole: 'guest', settings: { ...S, locked: true } }))).toBe('locked')
  })
})

describe('room roles and host menus', () => {
  it('my role follows the roster, else the join role', () => {
    const roster = [{ userId: 'me', role: 'cohost' as const, joinedAt: 't' }]
    expect(myRoomRole(roster, 'me', 'attendee')).toBe('cohost')
    expect(myRoomRole([], 'me', 'attendee')).toBe('attendee')
    expect(myRoomRole(undefined, 'me', 'host')).toBe('host')
    expect(isManager('cohost')).toBe(true)
    expect(isManager('invited')).toBe(false)
  })

  const target = (over: Partial<{ userId: string; role: 'host' | 'cohost' | 'attendee'; handRaised: boolean; micOn: boolean }> = {}) =>
    ({ userId: 't', role: 'attendee' as const, handRaised: false, micOn: true, ...over })

  it('host can do everything to an attendee', () => {
    expect(personActions('host', 'me', target({ handRaised: true })))
      .toEqual(['MUTE_MIC', 'LOWER_HAND', 'MAKE_COHOST', 'REMOVE'])
  })

  it('host manages co-hosts; co-hosts only attendees; nobody targets the host or themselves', () => {
    expect(personActions('host', 'me', target({ role: 'cohost', micOn: false }))).toEqual(['REVOKE_COHOST', 'REMOVE'])
    expect(personActions('cohost', 'me', target())).toEqual(['MUTE_MIC', 'REMOVE'])
    expect(personActions('cohost', 'me', target({ role: 'cohost' }))).toEqual(['MUTE_MIC'])
    expect(personActions('cohost', 'me', target({ role: 'host', handRaised: true }))).toEqual(['MUTE_MIC', 'LOWER_HAND'])
    expect(personActions('host', 'me', target({ userId: 'me', role: 'host' }))).toEqual([])
    expect(personActions('attendee', 'me', target())).toEqual([])
  })

  it('room controls send the opposite of the current setting', () => {
    expect(roomControls('attendee', S, true)).toBeNull()
    expect(roomControls('cohost', S, false)).toEqual({ muteAll: true, lowerAllHands: false, lock: 'LOCK',
      waitingRoom: 'WAITING_ROOM_OFF', screenShare: 'ATTENDEE_SCREEN_SHARE_OFF' })
    expect(roomControls('host', { ...S, locked: true, waitingRoom: false, allowAttendeeScreenShare: false }, true))
      .toEqual({ muteAll: true, lowerAllHands: true, lock: 'UNLOCK', waitingRoom: 'WAITING_ROOM_ON',
        screenShare: 'ATTENDEE_SCREEN_SHARE_ON' })
  })

  it('attendees present only when allowed', () => {
    expect(canShareScreen('attendee', S)).toBe(true)
    expect(canShareScreen('attendee', { ...S, allowAttendeeScreenShare: false })).toBe(false)
    expect(canShareScreen('cohost', { ...S, allowAttendeeScreenShare: false })).toBe(true)
  })
})
