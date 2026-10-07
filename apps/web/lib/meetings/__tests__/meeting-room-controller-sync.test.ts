import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { Meeting, MeetingEvent, RosterEntry } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import { meetingKeys, type MessageListData } from '@/lib/meetings/cache-updates'
import { MeetingRoomController, type MeetingRoomDeps } from '@/lib/meetings/meeting-room-controller'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { FakeSession } from './fake-room-session'

/** QA fixes: reconnect resync (P2-2), rejoin media (P2-4), lobby exit (P3-3), resent chat (P3-2). */

const MEETING: Meeting = { id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status: 'LIVE',
  settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'invited', createdAt: '2026-10-08T00:00:00Z' }
const JOINED = (role: 'host' | 'cohost' | 'attendee' = 'attendee') =>
  ({ status: 'joined' as const, url: 'wss://rtc', token: 'tok', role })
const store = () => useMeetingRoomStore.getState()

let session: FakeSession
let deps: MeetingRoomDeps & {
  api: { [K in keyof MeetingRoomDeps['api']]: ReturnType<typeof vi.fn> }
  notify: ReturnType<typeof vi.fn>
}
let c: MeetingRoomController

beforeEach(() => {
  session = new FakeSession()
  deps = {
    api: { join: vi.fn(), leaveLobby: vi.fn(async () => undefined), leaveLobbyOnExit: vi.fn(),
      get: vi.fn(), end: vi.fn(async () => undefined), admit: vi.fn(async () => undefined),
      deny: vi.fn(async () => undefined), lobby: vi.fn(async () => []) },
    queryClient: new QueryClient(),
    publish: vi.fn(), isRealtimeConnected: () => true,
    createSession: () => session, now: () => 10_000, newClientId: () => 'c-abc',
    notify: vi.fn(),
  } as unknown as typeof deps
  c = new MeetingRoomController(MEETING, 'me', deps)
  c.activate()
})

async function inRoom(role: 'host' | 'cohost' | 'attendee' = 'attendee', media = { mic: true, camera: true }) {
  deps.api.join.mockResolvedValueOnce(JOINED(role))
  await c.join(media)
}

const lastConnectOpts = () => session.connect.mock.calls.at(-1)?.[2]

describe('P2-2 — resync after a STOMP reconnect', () => {
  const later: Meeting = {
    ...MEETING,
    settings: { ...DEFAULT_MEETING_SETTINGS, locked: true, allowAttendeeScreenShare: true },
    attendance: [{ userId: 'me', displayName: 'Me', role: 'attendee', joinedAt: '2026-10-08T00:01:00Z' }],
    coHosts: [{ userId: 'me' }],
  }

  it('re-reads the meeting and applies settings and my role changed while offline', async () => {
    await inRoom('attendee')
    deps.queryClient.setQueryData(meetingKeys.byCode(MEETING.code), MEETING)
    deps.api.get.mockResolvedValueOnce(later)
    await c.onRealtimeReconnected()

    expect(deps.api.get).toHaveBeenCalledWith('m1')
    expect(store().myRole).toBe('cohost')
    expect(deps.queryClient.getQueryData<Meeting>(meetingKeys.byCode(MEETING.code))?.settings.locked).toBe(true)
    expect(deps.queryClient.getQueryData<Meeting>(meetingKeys.detail('m1'))?.settings.locked).toBe(true)
    expect(deps.queryClient.getQueryData<RosterEntry[]>(meetingKeys.roster('m1'))?.[0])
      .toMatchObject({ userId: 'me', role: 'cohost' })
    // Promoted while offline ⇒ the lobby is read too.
    expect(deps.api.lobby).toHaveBeenCalledWith('m1')
  })

  it('uses the re-read settings for screen share', async () => {
    await inRoom('attendee')
    c.onSettings({ ...DEFAULT_MEETING_SETTINGS, allowAttendeeScreenShare: false })
    await c.toggleScreenShare()
    expect(session.setScreenShare).not.toHaveBeenCalled()
    deps.api.get.mockResolvedValueOnce({ ...later, coHosts: [] })
    await c.onRealtimeReconnected()
    await c.toggleScreenShare()
    expect(session.setScreenShare).toHaveBeenCalledWith(true)
  })

  it('closes the room when the meeting ended while offline, and survives a failed read', async () => {
    await inRoom()
    deps.api.get.mockRejectedValueOnce(new Error('offline'))
    await c.onRealtimeReconnected()
    expect(store().phase).toBe('inRoom')

    deps.api.get.mockResolvedValueOnce({ ...MEETING, status: 'ENDED' })
    await c.onRealtimeReconnected()
    expect(store().phase).toBe('ended')
  })
})

describe('P2-4 — rejoin keeps my in-room media choice', () => {
  it('rejoins muted after I muted myself in the room', async () => {
    await inRoom()
    await c.toggleMic()
    await c.toggleCamera()
    session.onDisconnected?.('failed')
    expect(store().phase).toBe('connectionLost')

    deps.api.join.mockResolvedValueOnce(JOINED())
    await c.rejoin()
    expect(lastConnectOpts()).toMatchObject({ audio: false, video: false })
    expect(store()).toMatchObject({ phase: 'inRoom', mic: false, camera: false })
  })

  it('rejoins muted after a host muted me', async () => {
    await inRoom()
    c.handle({ event: 'meet.muted', meetingId: 'm1' })
    c.leave()
    deps.api.join.mockResolvedValueOnce(JOINED())
    await c.rejoin()
    expect(lastConnectOpts()).toMatchObject({ audio: false, video: true })
  })

  it('a failed toggle does not change what a rejoin uses, nor does the teardown of a dropped room', async () => {
    await inRoom('attendee', { mic: false, camera: true })
    session.setMic.mockRejectedValueOnce(new Error('x'))
    await c.toggleMic()
    // LiveKit unpublishes everything before it reports the drop.
    session.onLocalMediaChanged?.({ mic: false, camera: false, screen: false })
    session.onDisconnected?.('failed')
    deps.api.join.mockResolvedValueOnce(JOINED())
    await c.rejoin()
    expect(lastConnectOpts()).toMatchObject({ audio: false, video: true })
  })
})

describe('P3-3 — leaving the page while waiting', () => {
  it('drops the lobby entry with a keepalive request only while waiting', async () => {
    c.leaveLobbyOnExit()
    expect(deps.api.leaveLobbyOnExit).not.toHaveBeenCalled()
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    c.leaveLobbyOnExit()
    expect(deps.api.leaveLobbyOnExit).toHaveBeenCalledWith('m1')
  })
})

describe('P3-2 — a resent chat line comes back on my personal queue', () => {
  const echo = (id: string): Extract<MeetingEvent, { event: 'meet.chat' }> => ({ event: 'meet.chat', meetingId: 'm1',
    clientId: 'c-abc', message: { id, sender: { userId: 'me' }, content: 'hi', createdAt: 't' } })
  const ids = () => deps.queryClient.getQueryData<MessageListData>(meetingKeys.messages('m1'))
    ?.pages.flatMap((p) => p.content.map((m) => m.id))

  it('a retry reuses the clientId; the stored line resolves the failed one without a duplicate or unread', async () => {
    await inRoom()
    c.sendChat('hi')
    c.handle({ event: 'meet.error', meetingId: 'm1', clientId: 'c-abc', errorCode: 'RATE_LIMITED' })
    c.retryChat('c-abc')
    expect(deps.publish).toHaveBeenLastCalledWith('/app/meet.chat', { meetingId: 'm1', content: 'hi', clientId: 'c-abc' })

    // The first attempt was stored after all: the room echo, then the personal re-echo of the retry.
    c.onChat(echo('x1'))
    deps.queryClient.setQueryData<MessageListData>(meetingKeys.messages('m1'),
      { pages: [{ content: [echo('x1').message], page: 0, size: 50, totalElements: 1, hasNext: false }], pageParams: [undefined] })
    c.handle(echo('x1'))
    expect(ids()).toEqual(['x1'])
    expect(store().pendingChat).toEqual([])
    expect(store().unreadChat).toBe(0)
  })

  it('a personal echo alone settles the pending line and adds it to the history', async () => {
    await inRoom()
    c.sendChat('hi')
    c.handle(echo('x2'))
    expect(store().pendingChat).toEqual([])
    expect(ids()).toEqual(['x2'])
    expect(store().unreadChat).toBe(0)
  })
})
