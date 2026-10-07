import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { Meeting, MeetingEvent, MeetingPage } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import { meetingKeys, type MeetingListData } from '@/lib/meetings/cache-updates'
import { handleMeetingQueueEvent, type MeetingQueueContext } from '@/lib/realtime/meeting-queue'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key

const NOW = new Date('2026-10-07T09:00:00Z')

function meeting(id: string, over: Partial<Meeting> = {}): Meeting {
  return { id, code: 'abc-defg-hjk', title: 'Weekly', host: { userId: 'h', displayName: 'Lan' },
    status: 'SCHEDULED', settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'invited',
    createdAt: '2026-10-07T00:00:00Z', scheduledStart: '2026-10-08T02:00:00Z', ...over }
}
function seedUpcoming(qc: QueryClient, rows: Meeting[]) {
  const page: MeetingPage = { content: rows, page: 0, size: 20, totalElements: rows.length, hasNext: false }
  qc.setQueryData<MeetingListData>(meetingKeys.list('upcoming'), { pages: [page], pageParams: [undefined] })
}
const upcomingIds = (qc: QueryClient) =>
  qc.getQueryData<MeetingListData>(meetingKeys.list('upcoming'))?.pages.flatMap((p) => p.content.map((m) => m.id))

let qc: QueryClient
let ctx: MeetingQueueContext
let room: { meetingId: string; handle: Mock<(e: MeetingEvent) => void> } | null

beforeEach(() => {
  qc = new QueryClient()
  room = null
  ctx = {
    queryClient: qc, t, locale: 'en', now: () => NOW,
    notificationsEnabled: () => true,
    notify: vi.fn(), toastInfo: vi.fn(),
    activeRoom: () => room,
  }
})

describe('invitations and reminders', () => {
  const invited: MeetingEvent = { event: 'meet.invited', meetingId: 'm2', code: 'xyz-wxyz-xyz',
    title: 'Planning', hostId: '64b0aaaaaaaaaaaaaaaaaaaa', hostName: 'Lan' }

  it('adds a placeholder row and notifies with the host name, linking to the room', () => {
    seedUpcoming(qc, [meeting('m1')])
    handleMeetingQueueEvent(invited, ctx)
    // No scheduledStart ⇒ an instant meeting, sorted by its creation time (now), which is
    // before m1's start (plan said ['m1', 'm2'], which contradicts the server sort order).
    expect(upcomingIds(qc)).toEqual(['m2', 'm1'])
    expect(ctx.notify).toHaveBeenCalledWith({
      title: 'notifInvitedTitle', body: 'notifInvitedBody(Lan,Planning)', href: '/meet/xyz-wxyz-xyz',
    })
  })

  it('never shows the raw host id and falls back to generic labels', () => {
    handleMeetingQueueEvent({ ...invited, title: undefined, hostName: '64b0aaaaaaaaaaaaaaaaaaaa' }, ctx)
    const body = vi.mocked(ctx.notify).mock.calls[0][0].body
    expect(body).toBe('notifInvitedBody(someone,untitled)')
    expect(body).not.toContain('64b0')
  })

  it('does not overwrite a real row and stays silent when notifications are off', () => {
    const real = meeting('m2', { title: 'Real one' })
    seedUpcoming(qc, [real])
    ctx.notificationsEnabled = () => false
    handleMeetingQueueEvent(invited, ctx)
    expect(qc.getQueryData<MeetingListData>(meetingKeys.list('upcoming'))?.pages[0].content[0]).toBe(real)
    expect(ctx.notify).not.toHaveBeenCalled()
  })

  it('reminds with the start time', () => {
    handleMeetingQueueEvent({ event: 'meet.starting', meetingId: 'm1', code: 'abc-defg-hjk',
      title: 'Weekly', scheduledStart: '2026-10-08T02:00:00Z' }, ctx)
    const n = vi.mocked(ctx.notify).mock.calls[0][0]
    expect(n.title).toBe('notifStartingTitle')
    expect(n.body.startsWith('notifStartingBody(Weekly,')).toBe(true)
    expect(n.href).toBe('/meet/abc-defg-hjk')
  })
})

describe('cancellation and end', () => {
  it('drops a cancelled meeting from upcoming, marks the detail cancelled and names it', () => {
    seedUpcoming(qc, [meeting('m1'), meeting('m3')])
    qc.setQueryData(meetingKeys.detail('m1'), meeting('m1'))
    handleMeetingQueueEvent({ event: 'meet.cancelled', meetingId: 'm1' }, ctx)
    expect(upcomingIds(qc)).toEqual(['m3'])
    expect(qc.getQueryData<Meeting>(meetingKeys.detail('m1'))).toMatchObject({ status: 'ENDED', cancelledAt: NOW.toISOString() })
    expect(ctx.toastInfo).toHaveBeenCalledWith('notifCancelled(Weekly)')
  })

  it('prefers the title the cancellation carries (gap B3)', () => {
    qc.setQueryData(meetingKeys.detail('m1'), meeting('m1', { title: 'Old title' }))
    handleMeetingQueueEvent({ event: 'meet.cancelled', meetingId: 'm1', title: 'Planning', code: 'abc-defg-hjk' }, ctx)
    expect(ctx.toastInfo).toHaveBeenCalledWith('notifCancelled(Planning)')
  })

  it('forwards a cancellation to the open room of that meeting', () => {
    room = { meetingId: 'm1', handle: vi.fn<(e: MeetingEvent) => void>() }
    const e: MeetingEvent = { event: 'meet.cancelled', meetingId: 'm1' }
    handleMeetingQueueEvent(e, ctx)
    expect(room.handle).toHaveBeenCalledWith(e)
  })

  it('uses a generic sentence when the meeting is not cached', () => {
    handleMeetingQueueEvent({ event: 'meet.cancelled', meetingId: 'zz' }, ctx)
    expect(ctx.toastInfo).toHaveBeenCalledWith('notifCancelledUnknown')
  })

  it('marks the past list stale without refetching it', () => {
    qc.setQueryData(meetingKeys.list('past'), { pages: [], pageParams: [] })
    handleMeetingQueueEvent({ event: 'meet.ended', meetingId: 'm1' }, ctx)
    expect(qc.getQueryState(meetingKeys.list('past'))?.isInvalidated).toBe(true)
  })
})

describe('room events', () => {
  it('stores the lobby and forwards room events to the open room only', () => {
    room = { meetingId: 'm1', handle: vi.fn<(e: MeetingEvent) => void>() }
    const lobby: MeetingEvent = { event: 'meet.lobby', meetingId: 'm1', waiting: [{ userId: 'g', displayName: 'Guest' }] }
    handleMeetingQueueEvent(lobby, ctx)
    expect(qc.getQueryData(meetingKeys.lobby('m1'))).toEqual([{ userId: 'g', displayName: 'Guest' }])
    expect(room.handle).toHaveBeenCalledWith(lobby)

    handleMeetingQueueEvent({ event: 'meet.removed', meetingId: 'other' }, ctx)
    expect(room.handle).toHaveBeenCalledTimes(1)

    const err: MeetingEvent = { event: 'meet.error', errorCode: 'RATE_LIMITED' }
    handleMeetingQueueEvent(err, ctx)
    expect(room.handle).toHaveBeenLastCalledWith(err)
  })

  it('ignores room events when no room is open', () => {
    expect(() => handleMeetingQueueEvent({ event: 'meet.admitted', meetingId: 'm1' }, ctx)).not.toThrow()
    expect(ctx.notify).not.toHaveBeenCalled()
  })
})
