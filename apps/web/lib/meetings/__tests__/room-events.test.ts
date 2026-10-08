import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { Meeting, MeetingMessagePage } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import { flattenMessages, meetingKeys, type MessageListData } from '@/lib/meetings/cache-updates'
import { applyRoomEvent, type RoomEventDeps } from '@/lib/meetings/room-events'

const NOW = new Date('2026-10-08T03:00:00Z')
const base: Meeting = { id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status: 'LIVE',
  settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'invited', createdAt: '2026-10-08T00:00:00Z' }

function deps(qc: QueryClient, over: Partial<RoomEventDeps> = {}): RoomEventDeps {
  return { queryClient: qc, meetingId: 'm1', code: 'abc-defg-hjk', now: () => NOW,
    onRoster: vi.fn(), onSettings: vi.fn(), onChat: vi.fn(), onSharedNoteUpdated: vi.fn(), onEnded: vi.fn(), ...over }
}

describe('applyRoomEvent', () => {
  it('ignores another meeting', () => {
    const qc = new QueryClient()
    const d = deps(qc)
    applyRoomEvent({ event: 'meet.hands', meetingId: 'other', hands: [] }, d)
    expect(qc.getQueryData(meetingKeys.hands('other'))).toBeUndefined()
  })

  it('replaces roster and hands', () => {
    const qc = new QueryClient()
    const d = deps(qc)
    const participants = [{ userId: 'a', role: 'cohost' as const, joinedAt: 't' }]
    applyRoomEvent({ event: 'meet.roster', meetingId: 'm1', participants }, d)
    expect(qc.getQueryData(meetingKeys.roster('m1'))).toEqual(participants)
    expect(d.onRoster).toHaveBeenCalledWith(participants)
    const hands = [{ userId: 'b', raisedAt: 't' }]
    applyRoomEvent({ event: 'meet.hands', meetingId: 'm1', hands }, d)
    expect(qc.getQueryData(meetingKeys.hands('m1'))).toEqual(hands)
  })

  it('patches settings into both detail caches', () => {
    const qc = new QueryClient()
    qc.setQueryData(meetingKeys.detail('m1'), base)
    qc.setQueryData(meetingKeys.byCode('abc-defg-hjk'), base)
    const settings = { ...DEFAULT_MEETING_SETTINGS, allowAttendeeScreenShare: false }
    applyRoomEvent({ event: 'meet.settings', meetingId: 'm1', settings }, deps(qc))
    expect(qc.getQueryData<Meeting>(meetingKeys.detail('m1'))?.settings).toEqual(settings)
    expect(qc.getQueryData<Meeting>(meetingKeys.byCode('abc-defg-hjk'))?.settings).toEqual(settings)
  })

  it('appends chat lines to the history cache and reports them', () => {
    const qc = new QueryClient()
    const page: MeetingMessagePage = { content: [], page: 0, size: 50, totalElements: 0, hasNext: false }
    qc.setQueryData<MessageListData>(meetingKeys.messages('m1'), { pages: [page], pageParams: [undefined] })
    const d = deps(qc)
    const e = { event: 'meet.chat' as const, meetingId: 'm1', clientId: 'c-1',
      message: { id: 'x', sender: { userId: 'a' }, content: 'hi', createdAt: 't' } }
    applyRoomEvent(e, d)
    expect(flattenMessages(qc.getQueryData(meetingKeys.messages('m1'))).map((m) => m.id)).toEqual(['x'])
    expect(d.onChat).toHaveBeenCalledWith(e)
  })

  it('signals shared-note updates and the end of the meeting', () => {
    const qc = new QueryClient()
    qc.setQueryData(meetingKeys.detail('m1'), base)
    const d = deps(qc)
    applyRoomEvent({ event: 'meet.notes.updated', meetingId: 'm1', version: 4, updatedBy: { userId: 'u', displayName: 'U' } }, d)
    expect(d.onSharedNoteUpdated).toHaveBeenCalledWith(4, { userId: 'u', displayName: 'U' })
    applyRoomEvent({ event: 'meet.ended', meetingId: 'm1' }, d)
    expect(qc.getQueryData<Meeting>(meetingKeys.detail('m1'))).toMatchObject({ status: 'ENDED', endedAt: NOW.toISOString() })
    expect(d.onEnded).toHaveBeenCalled()
  })
})
