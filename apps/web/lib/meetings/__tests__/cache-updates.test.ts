import { describe, it, expect } from 'vitest'
import type { Meeting, MeetingMessage, MeetingPage, MeetingMessagePage } from '@/lib/api/meeting-types'
import {
  appendMessage, flattenMessages, invitedPlaceholder, markEnded, meetingSortAt, removeFromList,
  replaceInList, rosterFromMeeting, upsertUpcoming, withSettings,
  type MeetingListData, type MessageListData,
} from '@/lib/meetings/cache-updates'

const SETTINGS = { waitingRoom: true, muteOnEntry: false, allowAttendeeScreenShare: true,
  attendeesCanEditNotes: true, locked: false }

function meeting(id: string, over: Partial<Meeting> = {}): Meeting {
  return { id, code: `${id}-code`, host: { userId: 'h', displayName: 'Host' }, status: 'SCHEDULED',
    settings: SETTINGS, viewerRole: 'invited', createdAt: '2026-10-07T00:00:00Z', ...over }
}
function page(content: Meeting[], hasNext = false): MeetingPage {
  return { content, page: 0, size: 20, totalElements: content.length, hasNext }
}
function list(...pages: MeetingPage[]): MeetingListData {
  return { pages, pageParams: pages.map((_, i) => (i === 0 ? undefined : `c${i}`)) }
}
const ids = (d: MeetingListData | undefined) => d?.pages.map((p) => p.content.map((m) => m.id))

describe('upcoming list', () => {
  const a = meeting('a', { scheduledStart: '2026-10-08T01:00:00Z' })
  const c = meeting('c', { scheduledStart: '2026-10-08T03:00:00Z' })

  it('sorts by scheduledStart, instant meetings by creation', () => {
    expect(meetingSortAt(a)).toBe('2026-10-08T01:00:00Z')
    expect(meetingSortAt(meeting('i'))).toBe('2026-10-07T00:00:00Z')
  })

  it('inserts a new meeting in start order and replaces an existing one', () => {
    const b = meeting('b', { scheduledStart: '2026-10-08T02:00:00Z' })
    const data = upsertUpcoming(list(page([a, c])), b)
    expect(ids(data)).toEqual([['a', 'b', 'c']])
    const renamed = upsertUpcoming(data, { ...b, title: 'Renamed' })
    expect(renamed?.pages[0].content[1].title).toBe('Renamed')
    expect(ids(renamed)).toEqual([['a', 'b', 'c']])
  })

  it('appends past the last loaded row only when there is no next page', () => {
    const late = meeting('z', { scheduledStart: '2026-12-01T00:00:00Z' })
    expect(ids(upsertUpcoming(list(page([a, c], true)), late))).toEqual([['a', 'c']])
    expect(ids(upsertUpcoming(list(page([a, c], false)), late))).toEqual([['a', 'c', 'z']])
  })

  it('leaves an unloaded list alone and removes rows by id', () => {
    expect(upsertUpcoming(undefined, a)).toBeUndefined()
    expect(ids(removeFromList(list(page([a]), page([c])), 'c'))).toEqual([['a'], []])
    expect(ids(replaceInList(list(page([a])), meeting('nope')))).toEqual([['a']])
  })
})

describe('invitedPlaceholder', () => {
  it('builds a scheduled row the list can show — host name only, id kept for identity', () => {
    const m = invitedPlaceholder({ event: 'meet.invited', meetingId: 'm1', code: 'abc-defg-hjk', title: 'Sync',
      hostId: 'h1', hostName: 'Lan', scheduledStart: '2026-10-08T02:00:00Z' }, '2026-10-07T09:00:00Z')
    expect(m).toMatchObject({ id: 'm1', code: 'abc-defg-hjk', title: 'Sync', status: 'SCHEDULED',
      viewerRole: 'invited', host: { userId: 'h1', displayName: 'Lan' },
      scheduledStart: '2026-10-08T02:00:00Z', createdAt: '2026-10-07T09:00:00Z' })
    expect(m.settings).toEqual(SETTINGS)
  })
})

describe('detail patches', () => {
  it('marks a meeting ended or cancelled', () => {
    expect(markEnded(meeting('a', { status: 'LIVE' }), 'T', false)).toMatchObject({ status: 'ENDED', endedAt: 'T' })
    expect(markEnded(meeting('a'), 'T', true)).toMatchObject({ status: 'ENDED', cancelledAt: 'T' })
    expect(markEnded(undefined, 'T', false)).toBeUndefined()
  })

  it('swaps settings', () => {
    expect(withSettings(meeting('a'), { ...SETTINGS, locked: true })?.settings.locked).toBe(true)
  })

  it('builds the roster from open attendance rows with the current role', () => {
    const m = meeting('a', {
      host: { userId: 'h' }, coHosts: [{ userId: 'co' }],
      attendance: [
        { userId: 'h', displayName: 'Host', role: 'host', joinedAt: '2026-10-08T02:00:00Z' },
        { userId: 'co', displayName: 'Co', role: 'attendee', joinedAt: '2026-10-08T02:01:00Z' },
        { userId: 'x', role: 'attendee', joinedAt: '2026-10-08T02:02:00Z', leftAt: '2026-10-08T02:03:00Z' },
        { userId: 'y', role: 'attendee', joinedAt: '2026-10-08T02:02:00Z' },
        { userId: 'y', displayName: 'Yen', role: 'attendee', joinedAt: '2026-10-08T02:09:00Z' },
      ],
    })
    expect(rosterFromMeeting(m)).toEqual([
      { userId: 'h', displayName: 'Host', role: 'host', joinedAt: '2026-10-08T02:00:00Z' },
      { userId: 'co', displayName: 'Co', role: 'cohost', joinedAt: '2026-10-08T02:01:00Z' },
      { userId: 'y', displayName: 'Yen', role: 'attendee', joinedAt: '2026-10-08T02:09:00Z' },
    ])
    expect(rosterFromMeeting(meeting('b'))).toEqual([])
  })
})

describe('chat cache', () => {
  const msg = (id: string, at: string): MeetingMessage =>
    ({ id, sender: { userId: 'a' }, content: id, createdAt: at })
  const mpage = (content: MeetingMessage[]): MeetingMessagePage =>
    ({ content, page: 0, size: 50, totalElements: content.length, hasNext: false })

  it('prepends live lines to the newest page and dedupes by id', () => {
    const data: MessageListData = { pages: [mpage([msg('m2', 't2'), msg('m1', 't1')]), mpage([msg('m0', 't0')])],
      pageParams: [undefined, 'm1'] }
    const next = appendMessage(data, msg('m3', 't3'))
    expect(next.pages[0].content.map((m) => m.id)).toEqual(['m3', 'm2', 'm1'])
    expect(appendMessage(next, msg('m0', 't0'))).toBe(next)
    expect(flattenMessages(next).map((m) => m.id)).toEqual(['m0', 'm1', 'm2', 'm3'])
  })

  it('starts a cache when none is loaded', () => {
    const fresh = appendMessage(undefined, msg('m1', 't1'))
    expect(flattenMessages(fresh).map((m) => m.id)).toEqual(['m1'])
    expect(flattenMessages(undefined)).toEqual([])
  })
})
