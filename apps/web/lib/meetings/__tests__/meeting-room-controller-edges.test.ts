/** Race guards and delegations of MeetingRoomController not covered by the main suites. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import type { Meeting } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import { MeetingRoomController, type MeetingRoomDeps } from '@/lib/meetings/meeting-room-controller'
import { MediaAccessError } from '@/lib/rtc/livekit-errors'
import { FakeSession } from './fake-room-session'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'

function httpError(status: number, code?: string): AxiosError {
  const response = { status, data: code ? { code } : {}, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError('x', 'ERR', undefined, undefined, response as AxiosResponse)
}
const MEETING: Meeting = { id: 'm1', code: 'abc-defg-hjk', host: { userId: 'h' }, status: 'LIVE',
  settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'invited', createdAt: '2026-10-08T00:00:00Z' }
const JOINED = (role: 'host' | 'attendee' = 'attendee') => ({ status: 'joined' as const, url: 'wss://rtc', token: 'tok', role })
const store = () => useMeetingRoomStore.getState()

type Fn = ReturnType<typeof vi.fn>
let session: FakeSession
let deps: Omit<MeetingRoomDeps, 'api' | 'notify'> & { api: Record<keyof MeetingRoomDeps['api'], Fn>; notify: Fn }
let c: MeetingRoomController

beforeEach(() => {
  session = new FakeSession()
  deps = {
    api: { join: vi.fn(), leaveLobby: vi.fn(async () => undefined), leaveLobbyOnExit: vi.fn(), get: vi.fn(),
      end: vi.fn(async () => undefined), admit: vi.fn(async () => undefined), deny: vi.fn(async () => undefined),
      lobby: vi.fn(async () => []) },
    queryClient: new QueryClient(), publish: vi.fn(), isRealtimeConnected: vi.fn(() => true),
    createSession: () => session, now: vi.fn(() => 10_000), newClientId: () => 'c1', notify: vi.fn(),
  } as unknown as typeof deps
  c = new MeetingRoomController(MEETING, 'me', deps as unknown as MeetingRoomDeps)
  c.activate()
})

async function inRoom(role: 'host' | 'attendee' = 'attendee') {
  deps.api.join.mockResolvedValueOnce(JOINED(role))
  await c.join({ mic: true, camera: true })
  expect(store().phase).toBe('inRoom')
}

describe('lifecycle guards', () => {
  it('dispose while waiting leaves the lobby (errors swallowed)', async () => {
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    deps.api.leaveLobby.mockRejectedValueOnce(new Error('offline'))
    c.dispose()
    expect(deps.api.leaveLobby).toHaveBeenCalledWith('m1')
  })

  it('a join answer after dispose is ignored', async () => {
    let resolve!: (v: unknown) => void
    deps.api.join.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const p = c.join({ mic: true, camera: true })
    c.dispose()
    resolve(JOINED())
    await p
    expect(session.connect).not.toHaveBeenCalled()
    let reject!: (e: unknown) => void
    const c2 = new MeetingRoomController(MEETING, 'me', deps as unknown as MeetingRoomDeps)
    c2.activate()
    deps.api.join.mockReturnValueOnce(new Promise((_r, rj) => { reject = rj }))
    const p2 = c2.join({ mic: true, camera: true })
    c2.dispose()
    reject(httpError(403, 'MEETING_LOCKED'))
    await p2
    expect(store().phase).not.toBe('locked')
  })

  it('mic refused falls back to joining without media; if that fails too the connection is lost', async () => {
    deps.api.join.mockResolvedValueOnce(JOINED())
    session.connect.mockRejectedValueOnce(new MediaAccessError()).mockRejectedValueOnce(new Error('ws'))
    await c.join({ mic: true, camera: true })
    expect(deps.notify).toHaveBeenCalledWith('error', { key: 'mediaFailed' })
    expect(session.connect).toHaveBeenLastCalledWith('wss://rtc', 'tok', { video: false, audio: false })
    expect(store().phase).toBe('connectionLost')
    expect(session.disconnect).toHaveBeenCalled()
  })

  it('a session finishing connect after dispose is disconnected', async () => {
    let resolve!: () => void
    deps.api.join.mockResolvedValueOnce(JOINED())
    session.connect.mockReturnValueOnce(new Promise<void>((r) => { resolve = r }))
    const p = c.join({ mic: true, camera: true })
    await vi.waitFor(() => expect(session.connect).toHaveBeenCalled())
    c.dispose()
    resolve()
    await p
    expect(session.disconnect).toHaveBeenCalled()
  })
})

describe('host commands and media delegation', () => {
  it('endForAll failure notifies and stays in the room', async () => {
    await inRoom('host')
    deps.api.end.mockRejectedValueOnce(httpError(403, 'MEETING_HOST_ONLY'))
    await c.endForAll()
    expect(deps.notify).toHaveBeenCalledWith('error', expect.objectContaining({ key: expect.any(String) }))
    expect(store().phase).toBe('inRoom')
  })

  it('admit / deny call the API for that person', async () => {
    await inRoom('host')
    await c.admit('u1')
    await c.deny('u2')
    expect(deps.api.admit).toHaveBeenCalledWith('m1', 'u1')
    expect(deps.api.deny).toHaveBeenCalledWith('m1', 'u2')
  })

  it('switchDevice / setPeerVideoEnabled reach the session', async () => {
    await inRoom()
    await c.switchDevice('videoinput', 'cam2')
    c.setPeerVideoEnabled('p1', false)
    expect(session.switchDevice).toHaveBeenCalledWith('videoinput', 'cam2')
    expect(session.setPeerVideoEnabled).toHaveBeenCalledWith('p1', false)
  })

  it('settings revoking attendee share stop my share and tell me', async () => {
    await inRoom()
    useMeetingRoomStore.setState({ screen: true })
    session.setScreenShare.mockRejectedValueOnce(new Error('x'))
    c.onSettings({ ...DEFAULT_MEETING_SETTINGS, allowAttendeeScreenShare: false })
    expect(store().screen).toBe(false)
    expect(session.setScreenShare).toHaveBeenCalledWith(false)
    expect(deps.notify).toHaveBeenCalledWith('info', { key: 'shareRevoked' })
  })
})

describe('onRealtimeReconnected', () => {
  it('outside the room it does nothing', async () => {
    await c.onRealtimeReconnected()
    expect(deps.api.get).not.toHaveBeenCalled()
    expect(deps.api.join).not.toHaveBeenCalled()
  })

  it('while waiting it re-asks quietly: a glitch keeps the waiting screen', async () => {
    deps.api.join.mockResolvedValueOnce({ status: 'waiting' })
    await c.join({ mic: true, camera: true })
    deps.api.join.mockRejectedValueOnce(httpError(503))
    await c.onRealtimeReconnected()
    expect(deps.api.join).toHaveBeenCalledTimes(2)
    expect(store().phase).toBe('waiting')
  })

  it('in the room: an ENDED meeting closes it', async () => {
    await inRoom()
    deps.api.get.mockResolvedValueOnce({ ...MEETING, status: 'ENDED' })
    await c.onRealtimeReconnected()
    expect(store().phase).toBe('ended')
  })

  it('in the room as host: re-reads roster, settings and the lobby', async () => {
    await inRoom('host')
    deps.api.get.mockResolvedValueOnce({ ...MEETING, attendance: [] })
    await c.onRealtimeReconnected()
    expect(deps.api.lobby).toHaveBeenCalledWith('m1')
    expect(store().phase).toBe('inRoom')
  })

  it('a result arriving after leaving is ignored', async () => {
    await inRoom()
    let resolve!: (m: Meeting) => void
    deps.api.get.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const p = c.onRealtimeReconnected()
    c.leave()
    resolve({ ...MEETING, status: 'ENDED' })
    await p
    expect(store().phase).toBe('left')
  })
})
