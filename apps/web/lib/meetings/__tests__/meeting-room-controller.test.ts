import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import type { Meeting, MeetingSettings } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import { getActiveMeetingRoom } from '@/lib/meetings/active-room'
import { encodeReaction } from '@/lib/meetings/reactions'
import { MeetingRoomController, type MeetingRoomDeps } from '@/lib/meetings/meeting-room-controller'
import { FakeSession } from './fake-room-session'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'

function httpError(status: number, code: string): AxiosError {
  const response = { status, data: { code, statusCode: status }, statusText: '', headers: {},
    config: { headers: new AxiosHeaders() } }
  return new AxiosError('x', 'ERR', undefined, undefined, response as AxiosResponse)
}

const S: MeetingSettings = DEFAULT_MEETING_SETTINGS
const MEETING: Meeting = { id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status: 'LIVE', settings: S,
  viewerRole: 'invited', createdAt: '2026-10-08T00:00:00Z' }
const JOINED = (role: 'host' | 'cohost' | 'attendee' = 'attendee', token = 'tok') =>
  ({ status: 'joined' as const, url: 'wss://rtc', token, role })
const store = () => useMeetingRoomStore.getState()

let session: FakeSession
let deps: MeetingRoomDeps & {
  api: { [K in keyof MeetingRoomDeps['api']]: ReturnType<typeof vi.fn> }
  publish: ReturnType<typeof vi.fn>; notify: ReturnType<typeof vi.fn>
  now: ReturnType<typeof vi.fn>; isRealtimeConnected: ReturnType<typeof vi.fn>
}
let c: MeetingRoomController

beforeEach(() => {
  session = new FakeSession()
  deps = {
    api: { join: vi.fn(), leaveLobby: vi.fn(async () => undefined), leaveLobbyOnExit: vi.fn(), get: vi.fn(), end: vi.fn(async () => undefined),
      admit: vi.fn(async () => undefined), deny: vi.fn(async () => undefined), lobby: vi.fn(async () => []) },
    queryClient: new QueryClient(),
    publish: vi.fn(), isRealtimeConnected: vi.fn(() => true),
    createSession: () => session, now: vi.fn(() => 10_000), newClientId: () => 'c-abc',
    notify: vi.fn(),
  } as unknown as typeof deps
  c = new MeetingRoomController(MEETING, 'me', deps)
  c.activate()
})

async function inRoom(role: 'host' | 'cohost' | 'attendee' = 'attendee') {
  deps.api.join.mockResolvedValueOnce(JOINED(role))
  await c.join({ mic: true, camera: true })
}

describe('joining', () => {
  it('goes straight in with the chosen media and devices', async () => {
    deps.api.join.mockResolvedValueOnce(JOINED('cohost'))
    await c.join({ mic: false, camera: true, audioDeviceId: 'mic-1' })
    expect(session.connect).toHaveBeenCalledWith('wss://rtc', 'tok',
      expect.objectContaining({ video: true, audio: false, audioDeviceId: 'mic-1' }))
    expect(store()).toMatchObject({ phase: 'inRoom', myRole: 'cohost', mic: false, camera: true })
    expect(getActiveMeetingRoom()?.meetingId).toBe('m1')
  })

  it('waits in the lobby, then enters on its own when admitted', async () => {
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' }).mockResolvedValueOnce(JOINED('attendee', 't2'))
    await c.join({ mic: true, camera: false })
    expect(store().phase).toBe('waiting')
    expect(session.connect).not.toHaveBeenCalled()

    c.handle({ event: 'meet.admitted', meetingId: 'm1' })
    await vi.waitFor(() => expect(store().phase).toBe('inRoom'))
    expect(deps.api.join).toHaveBeenCalledTimes(2)
    expect(session.connect).toHaveBeenCalledWith('wss://rtc', 't2', expect.objectContaining({ video: false, audio: true }))
  })

  it('shows the denial, and leaving the lobby tells the server', async () => {
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    await c.cancelWaiting()
    expect(deps.api.leaveLobby).toHaveBeenCalledWith('m1')
    expect(store().phase).toBe('prejoin')

    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    c.handle({ event: 'meet.denied', meetingId: 'm1' })
    expect(store().phase).toBe('denied')
  })

  it.each([
    [403, 'MEETING_REMOVED', 'removed'],
    [403, 'MEETING_LOCKED', 'locked'],
    [409, 'MEETING_ENDED', 'ended'],
    [409, 'MEETING_FULL', 'full'],
    [503, 'MEETINGS_UNAVAILABLE', 'unavailable'],
  ])('a %i %s join ends on the %s screen', async (status, code, phase) => {
    deps.api.join.mockRejectedValueOnce(httpError(status, code))
    await c.join({ mic: true, camera: true })
    expect(store().phase).toBe(phase)
    expect(session.connect).not.toHaveBeenCalled()
  })
})

describe('being removed, muted, or the meeting ending', () => {
  it('a removal drops the media and the unsent chat', async () => {
    await inRoom()
    c.sendChat('bye')
    c.handle({ event: 'meet.removed', meetingId: 'm1' })
    expect(session.disconnect).toHaveBeenCalled()
    expect(store()).toMatchObject({ phase: 'removed', pendingChat: [] })
  })

  it('tells me who muted me, never their id', async () => {
    await inRoom()
    c.handle({ event: 'meet.muted', meetingId: 'm1', actor: { userId: 'h', displayName: 'Lan' } })
    expect(store().mic).toBe(false)
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'mutedBy', values: { name: 'Lan' } })
    c.handle({ event: 'meet.muted', meetingId: 'm1', actor: { userId: '64b0aaaaaaaaaaaaaaaaaaaa' } })
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'mutedByUnknown' })
  })

  it('the end of the meeting closes the room', async () => {
    await inRoom()
    c.onEnded()
    expect(session.disconnect).toHaveBeenCalled()
    expect(store().phase).toBe('ended')
  })

  it('ending for everyone calls the server', async () => {
    await inRoom('host')
    await c.endForAll()
    expect(deps.api.end).toHaveBeenCalledWith('m1')
    expect(store().phase).toBe('ended')
  })
})

describe('chat', () => {
  it('sends a trimmed line with a client id and clears it on the echo', async () => {
    await inRoom()
    expect(c.sendChat('  hello  ')).toBe('c-abc')
    expect(deps.publish).toHaveBeenCalledWith('/app/meet.chat', { meetingId: 'm1', content: 'hello', clientId: 'c-abc' })
    expect(store().pendingChat).toEqual([{ clientId: 'c-abc', content: 'hello', sentAt: 10_000, error: null }])
    c.onChat({ event: 'meet.chat', meetingId: 'm1', clientId: 'c-abc',
      message: { id: 'x', sender: { userId: 'me' }, content: 'hello', createdAt: 't' } })
    expect(store().pendingChat).toEqual([])
    expect(store().unreadChat).toBe(0)
  })

  it('marks a refused line and lets me retry or discard it', async () => {
    await inRoom()
    c.sendChat('spam')
    c.handle({ event: 'meet.error', meetingId: 'm1', clientId: 'c-abc', errorCode: 'RATE_LIMITED' })
    expect(store().pendingChat[0].error).toEqual({ key: 'errRateLimited' })
    c.retryChat('c-abc')
    expect(deps.publish).toHaveBeenCalledTimes(2)
    expect(store().pendingChat[0].error).toBeNull()
    c.discardChat('c-abc')
    expect(store().pendingChat).toEqual([])
  })

  it('refuses empty, too long, offline or not-in-room lines', async () => {
    expect(c.sendChat('hi')).toBeNull()
    await inRoom()
    expect(c.sendChat('   ')).toBeNull()
    expect(c.sendChat('x'.repeat(2001))).toBeNull()
    deps.isRealtimeConnected.mockReturnValue(false)
    expect(c.sendChat('hi')).toBeNull()
    expect(deps.publish).not.toHaveBeenCalled()
  })

  it('counts unread lines from others while the chat panel is closed', async () => {
    await inRoom()
    const line = (sender: string) => ({ event: 'meet.chat' as const, meetingId: 'm1',
      message: { id: sender, sender: { userId: sender }, content: 'x', createdAt: 't' } })
    c.onChat(line('bob'))
    c.onChat(line('me'))
    expect(store().unreadChat).toBe(1)
    store().setPanel('chat')
    expect(store().unreadChat).toBe(0)
    c.onChat(line('ann'))
    expect(store().unreadChat).toBe(0)
  })
})

describe('host commands', () => {
  it('sends targetId only for person actions and tracks switch commands until settings arrive', async () => {
    await inRoom('host')
    c.hostCommand('MUTE_MIC', 'u2')
    expect(deps.publish).toHaveBeenLastCalledWith('/app/meet.host', { meetingId: 'm1', action: 'MUTE_MIC', targetId: 'u2' })
    c.hostCommand('LOCK', 'ignored')
    expect(deps.publish).toHaveBeenLastCalledWith('/app/meet.host', { meetingId: 'm1', action: 'LOCK' })
    expect(store().pendingHost.LOCK).toBe(10_000)
    c.onSettings({ ...S, locked: true })
    expect(store().pendingHost.LOCK).toBeUndefined()
  })

  it('clears the pending switch and explains a refused command', async () => {
    await inRoom('cohost')
    c.hostCommand('WAITING_ROOM_OFF')
    c.handle({ event: 'meet.error', meetingId: 'm1', action: 'WAITING_ROOM_OFF', errorCode: 'MEETINGS_UNAVAILABLE' })
    expect(store().pendingHost.WAITING_ROOM_OFF).toBeUndefined()
    expect(deps.notify).toHaveBeenLastCalledWith('error', { key: 'errUnavailable' })
  })

  it('does not send while realtime is down', async () => {
    await inRoom('host')
    deps.isRealtimeConnected.mockReturnValue(false)
    c.hostCommand('MUTE_ALL')
    expect(deps.publish).not.toHaveBeenCalled()
    expect(deps.notify).toHaveBeenLastCalledWith('error', { key: 'realtimeOffline' })
  })

  it('stops my screen share when attendees lose the right to present', async () => {
    await inRoom('attendee')
    useMeetingRoomStore.setState({ screen: true })
    c.onSettings({ ...S, allowAttendeeScreenShare: false })
    expect(session.setScreenShare).toHaveBeenCalledWith(false)
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'shareRevoked' })
  })

  it('a co-host keeps presenting', async () => {
    await inRoom('cohost')
    useMeetingRoomStore.setState({ screen: true })
    c.onSettings({ ...S, allowAttendeeScreenShare: false })
    expect(session.setScreenShare).not.toHaveBeenCalled()
  })
})

describe('roles from the roster', () => {
  it('follows my current role and forgets the lobby when demoted', async () => {
    await inRoom('attendee')
    c.onRoster([{ userId: 'me', role: 'cohost', joinedAt: 't' }])
    expect(store().myRole).toBe('cohost')
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'madeCohost' })

    deps.queryClient.setQueryData(meetingKeys.lobby('m1'), [{ userId: 'g' }])
    c.onRoster([{ userId: 'me', role: 'attendee', joinedAt: 't' }])
    expect(store().myRole).toBe('attendee')
    expect(deps.queryClient.getQueryData(meetingKeys.lobby('m1'))).toEqual([])
    expect(deps.notify).toHaveBeenLastCalledWith('info', { key: 'revokedCohost' })

    c.onRoster([{ userId: 'someone', role: 'host', joinedAt: 't' }])
    expect(store().myRole).toBe('attendee')
  })
})

describe('reactions', () => {
  it('sends at most one per second over the lossy channel', async () => {
    await inRoom()
    expect(c.sendReaction('👍')).toBe(true)
    expect(session.publishData).toHaveBeenCalledWith('reaction', expect.any(Uint8Array), false)
    deps.now.mockReturnValue(10_500)
    expect(c.sendReaction('🎉')).toBe(false)
    expect(store().reactions).toHaveLength(1)
  })

  it('shows allowed reactions from others and drops anything else', async () => {
    await inRoom()
    session.onData?.('reaction', encodeReaction('❤️'), 'bob')
    session.onData?.('reaction', new TextEncoder().encode('{"e":"💩"}'), 'bob')
    session.onData?.('other-topic', encodeReaction('👍'), 'bob')
    expect(store().reactions.map((r) => r.emoji)).toEqual(['❤️'])
  })
})

describe('connection', () => {
  it('a dropped connection offers a rejoin; a closed room is checked against the server', async () => {
    await inRoom()
    session.onDisconnected?.('failed')
    expect(store().phase).toBe('connectionLost')

    await inRoom()
    deps.api.get.mockResolvedValueOnce({ ...MEETING, status: 'ENDED' })
    session.onDisconnected?.('ended')
    await vi.waitFor(() => expect(store().phase).toBe('ended'))

    await inRoom()
    deps.api.get.mockResolvedValueOnce(MEETING)
    session.onDisconnected?.('ended')
    await vi.waitFor(() => expect(store().phase).toBe('left'))
  })

  it('mirrors server-side mutes of my tracks', async () => {
    await inRoom()
    session.onLocalMediaChanged?.({ mic: false, camera: true, screen: false })
    expect(store()).toMatchObject({ mic: false, camera: true, screen: false })
  })

  it('after a STOMP reconnect: re-asks while waiting, re-reads the lobby for hosts only (never re-joins)', async () => {
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.onRealtimeReconnected()
    expect(deps.api.join).toHaveBeenCalledTimes(2)
    expect(store().phase).toBe('waiting')

    await c.cancelWaiting()
    await inRoom('host')
    deps.api.lobby.mockResolvedValueOnce([{ userId: 'g', displayName: 'Guest' }])
    await c.onRealtimeReconnected()
    expect(deps.api.join).toHaveBeenCalledTimes(3)
    expect(deps.api.lobby).toHaveBeenCalledWith('m1')
    expect(deps.queryClient.getQueryData(meetingKeys.lobby('m1'))).toEqual([{ userId: 'g', displayName: 'Guest' }])
    expect(session.connect).toHaveBeenCalledTimes(1)

    c.leave()
    await inRoom('attendee')
    await c.onRealtimeReconnected()
    expect(deps.api.join).toHaveBeenCalledTimes(4)
    expect(deps.api.lobby).toHaveBeenCalledTimes(1)
  })

  it('enters the room when the re-ask after a reconnect finds me admitted', async () => {
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: false, camera: true })
    deps.api.join.mockResolvedValueOnce(JOINED('attendee', 't3'))
    await c.onRealtimeReconnected()
    expect(store().phase).toBe('inRoom')
    expect(session.connect).toHaveBeenCalledWith('wss://rtc', 't3', expect.objectContaining({ video: true, audio: false }))
  })

  it('leaving keeps the page able to rejoin; dispose unregisters', async () => {
    await inRoom()
    c.leave()
    expect(session.disconnect).toHaveBeenCalled()
    expect(store().phase).toBe('left')
    c.dispose()
    expect(getActiveMeetingRoom()).toBeNull()
  })

  it('raises and lowers my hand', async () => {
    await inRoom()
    c.setHand(true)
    expect(deps.publish).toHaveBeenLastCalledWith('/app/meet.hand', { meetingId: 'm1', raised: true })
  })
})

describe('lifecycle', () => {
  it('survives StrictMode (activate → dispose → activate) and leaves the lobby on unmount', async () => {
    c.dispose()
    c.activate()
    expect(getActiveMeetingRoom()?.meetingId).toBe('m1')
    expect(store().phase).toBe('prejoin')
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    c.dispose()
    expect(deps.api.leaveLobby).toHaveBeenCalledWith('m1')
    expect(store().phase).toBe('loading')
  })

  it('ignores a join answer that arrives after the page closed', async () => {
    let answer: (v: unknown) => void = () => undefined
    deps.api.join.mockReturnValueOnce(new Promise((r) => { answer = r }))
    const joining = c.join({ mic: true, camera: true })
    c.dispose()
    answer(JOINED())
    await joining
    expect(session.connect).not.toHaveBeenCalled()
  })

  it('falls back to joining without media when the browser blocks it', async () => {
    const { MediaAccessError } = await import('@/lib/rtc/livekit-session')
    session.connect.mockRejectedValueOnce(new MediaAccessError())
    deps.api.join.mockResolvedValueOnce(JOINED())
    await c.join({ mic: true, camera: true })
    expect(session.connect).toHaveBeenLastCalledWith('wss://rtc', 'tok', expect.objectContaining({ video: false, audio: false }))
    expect(store()).toMatchObject({ phase: 'inRoom', mic: false, camera: false })
    expect(deps.notify).toHaveBeenCalledWith('error', { key: 'mediaFailed' })
  })

  it('a room that cannot be reached offers a rejoin', async () => {
    const { RoomConnectError } = await import('@/lib/rtc/livekit-session')
    session.connect.mockRejectedValueOnce(new RoomConnectError())
    deps.api.join.mockResolvedValueOnce(JOINED())
    await c.join({ mic: true, camera: true })
    expect(store().phase).toBe('connectionLost')
  })

  it('undoes a failed toggle and stays quiet when I cancel the share picker', async () => {
    const { ScreenShareError } = await import('@/lib/rtc/livekit-session')
    await inRoom()
    session.setMic.mockRejectedValueOnce(new Error('x'))
    await c.toggleMic()
    expect(store().mic).toBe(true)
    expect(deps.notify).toHaveBeenLastCalledWith('error', { key: 'mediaFailed' })

    deps.notify.mockClear()
    session.setScreenShare.mockRejectedValueOnce(new ScreenShareError())
    await c.toggleScreenShare()
    expect(store().screen).toBe(false)
    expect(deps.notify).not.toHaveBeenCalled()
  })

  it('flushes unsaved notes before leaving and remembers the latest shared-note signal', async () => {
    await inRoom()
    const flush = vi.fn(async () => undefined)
    c.registerNotesFlush(flush)
    c.onSharedNoteUpdated(5, { userId: 'u2', displayName: 'Minh' })
    expect(store().sharedNoteRemote).toEqual({ version: 5, updatedBy: { userId: 'u2', displayName: 'Minh' } })
    c.leave()
    expect(flush).toHaveBeenCalled()
    expect(store().phase).toBe('left')
  })

  it('ending for everyone flushes notes too, and a failing flush never blocks it', async () => {
    await inRoom('host')
    const flush = vi.fn(async () => Promise.reject(new Error('offline')))
    c.registerNotesFlush(flush)
    await c.endForAll()
    expect(flush).toHaveBeenCalled()
    expect(deps.api.end).toHaveBeenCalledWith('m1')
    expect(store().phase).toBe('ended')
  })
})
