import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

vi.mock('@/lib/rtc/livekit-session', async () => {
  const errs = await import('@/lib/rtc/livekit-errors')
  return { ScreenShareError: errs.ScreenShareError }
})

import { RoomMedia } from '@/lib/meetings/room-media'
import { wireRoomSession, peersPatch, type RoomSession, type MeetingRoomDeps } from '@/lib/meetings/room-session'
import { answerLobby, flushNotes } from '@/lib/meetings/room-host'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { ScreenShareError } from '@/lib/rtc/livekit-errors'
import { AxiosError, type AxiosResponse } from 'axios'

const initial = useMeetingRoomStore.getState()
const store = () => useMeetingRoomStore.getState()

function fakeSession() {
  return {
    setMic: vi.fn(async () => {}), setCamera: vi.fn(async () => {}), setScreenShare: vi.fn(async () => {}),
    switchDevice: vi.fn(async () => {}), setPeerVideoEnabled: vi.fn(), localScreenStream: vi.fn(() => null),
  } as unknown as RoomSession & Record<string, ReturnType<typeof vi.fn>>
}

let session: ReturnType<typeof fakeSession> | null
let notify: Mock<(level: "info" | "error", msg: unknown) => void>
let settings = { allowAttendeeScreenShare: false }
const media = () => new RoomMedia({ notify } as unknown as MeetingRoomDeps, () => session, () => settings as never)

beforeEach(() => {
  useMeetingRoomStore.setState(initial, true)
  useMeetingRoomStore.setState({ phase: 'inRoom', mic: true, camera: true, screen: false } as never)
  session = fakeSession()
  notify = vi.fn()
  settings = { allowAttendeeScreenShare: false }
})

describe('RoomMedia', () => {
  it('toggleMic flips the store, applies it and remembers it for rejoin', async () => {
    const m = media()
    await m.toggleMic()
    expect(session!.setMic).toHaveBeenCalledWith(false)
    expect(store().mic).toBe(false)
    expect(m.media.mic).toBe(false)
    await m.toggleCamera()
    expect(session!.setCamera).toHaveBeenCalledWith(false)
    expect(m.media).toEqual({ mic: false, camera: false })
  })

  it('a failed toggle rolls back and notifies', async () => {
    (session!.setCamera as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('x'))
    const m = media()
    await m.toggleCamera()
    expect(store().camera).toBe(true)
    expect(m.media.camera).toBe(true)
    expect(notify).toHaveBeenCalledWith('error', { key: 'mediaFailed' })
  })

  it('toggles are ignored outside the room or without a session', async () => {
    useMeetingRoomStore.setState({ phase: 'lobby' } as never)
    await media().toggleMic()
    session = null
    useMeetingRoomStore.setState({ phase: 'inRoom' } as never)
    await media().toggleMic()
    await media().toggleScreenShare()
    expect(store().mic).toBe(true)
  })

  it('screen share: attendees need the setting; managers may always share', async () => {
    await media().toggleScreenShare()
    expect(session!.setScreenShare).not.toHaveBeenCalled()
    settings = { allowAttendeeScreenShare: true }
    await media().toggleScreenShare()
    expect(session!.setScreenShare).toHaveBeenCalledWith(true)
    expect(store().screen).toBe(true)
    // turning it off never needs permission
    settings = { allowAttendeeScreenShare: false }
    await media().toggleScreenShare()
    expect(session!.setScreenShare).toHaveBeenLastCalledWith(false)
    useMeetingRoomStore.setState({ myRole: 'host', screen: false } as never)
    await media().toggleScreenShare()
    expect(store().screen).toBe(true)
  })

  it('a cancelled picker rolls back silently; other errors notify', async () => {
    useMeetingRoomStore.setState({ myRole: 'host' } as never)
    const share = session!.setScreenShare as ReturnType<typeof vi.fn>
    share.mockRejectedValueOnce(new ScreenShareError())
    await media().toggleScreenShare()
    expect(store().screen).toBe(false)
    expect(notify).not.toHaveBeenCalled()
    share.mockRejectedValueOnce(new Error('boom'))
    await media().toggleScreenShare()
    expect(store().screen).toBe(false)
    expect(notify).toHaveBeenCalledWith('error', { key: 'shareFailed' })
  })

  it('switchDevice records the device and notifies on failure', async () => {
    const m = media()
    await m.switchDevice('audioinput', 'mic2')
    await m.switchDevice('videoinput', 'cam2')
    expect(m.media).toMatchObject({ audioDeviceId: 'mic2', videoDeviceId: 'cam2' })
    expect(session!.switchDevice).toHaveBeenCalledWith('videoinput', 'cam2')
    ;(session!.switchDevice as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('x'))
    await m.switchDevice('videoinput', 'cam3')
    expect(notify).toHaveBeenCalledWith('error', { key: 'mediaFailed' })
    m.setPeerVideoEnabled('p1', false)
    expect(session!.setPeerVideoEnabled).toHaveBeenCalledWith('p1', false)
  })
})

describe('wireRoomSession', () => {
  it('drops every callback once the session is no longer current', () => {
    const s = {} as RoomSession
    const h = { isCurrent: () => false, onData: vi.fn(), onClosed: vi.fn() }
    wireRoomSession(s, h)
    const before = store()
    s.onLocalStream!({} as MediaStream)
    s.onPeersChanged!([])
    s.onReconnecting!(true)
    s.onLocalPoorConnection!(true)
    s.onLocalMediaChanged!({ mic: false } as never)
    s.onData!('t', new Uint8Array(), null)
    s.onDisconnected!('failed')
    expect(store()).toEqual(before)
    expect(h.onData).not.toHaveBeenCalled()
    expect(h.onClosed).not.toHaveBeenCalled()
  })

  it('forwards callbacks to the store while current', () => {
    const screen = {} as MediaStream
    const s = { localScreenStream: () => screen } as unknown as RoomSession
    const h = { isCurrent: () => true, onData: vi.fn(), onClosed: vi.fn() }
    wireRoomSession(s, h)
    s.onReconnecting!(true)
    s.onLocalPoorConnection!(true)
    expect(store()).toMatchObject({ reconnecting: true, poorConnection: true })
    s.onLocalMediaChanged!({ mic: false } as never)
    expect(store()).toMatchObject({ mic: false, localScreen: screen })
    s.onData!('topic', new Uint8Array([1]), 'p1')
    expect(h.onData).toHaveBeenCalledWith('topic', new Uint8Array([1]), 'p1')
    s.onDisconnected!('ended')
    expect(store()).toMatchObject({ reconnecting: false, screen: false })
    expect(h.onClosed).toHaveBeenCalledWith('ended')
  })

  it('peersPatch keeps the last speaker only while present', () => {
    const peers = [{ identity: 'a', speaking: false }, { identity: 'b', speaking: false }] as never
    expect(peersPatch(peers, 'b').activeSpeakerId).toBe('b')
    expect(peersPatch(peers, 'gone').activeSpeakerId).toBeNull()
  })
})

describe('room-host answerLobby / flushNotes', () => {
  it('admits: removes the person from the cached lobby', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(meetingKeys.lobby('m1'), [{ userId: 'u1' }, { userId: 'u2' }])
    const call = vi.fn(async () => {})
    await answerLobby({ queryClient, notify }, 'm1', 'u1', call)
    expect(queryClient.getQueryData(meetingKeys.lobby('m1'))).toEqual([{ userId: 'u2' }])
  })

  it('failure keeps the lobby and notifies the mapped key', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(meetingKeys.lobby('m1'), [{ userId: 'u1' }])
    const e = new AxiosError('x')
    e.response = { status: 429, data: {} } as AxiosResponse
    await answerLobby({ queryClient, notify }, 'm1', 'u1', async () => { throw e })
    expect(queryClient.getQueryData(meetingKeys.lobby('m1'))).toEqual([{ userId: 'u1' }])
    expect(notify).toHaveBeenCalledWith('error', { key: 'errRateLimited' })
  })

  it('flushNotes never throws', async () => {
    const flush = vi.fn(async () => { throw new Error('offline') })
    expect(() => flushNotes(flush)).not.toThrow()
    expect(flush).toHaveBeenCalled()
    expect(() => flushNotes(null)).not.toThrow()
    await Promise.resolve()
  })
})

describe('meeting store actions', () => {
  it('setPanel(chat) clears unread; togglePin toggles; setAudioOutput / reset', () => {
    useMeetingRoomStore.setState({ unreadChat: 3 } as never)
    store().setPanel('people' as never)
    expect(store()).toMatchObject({ panel: 'people', unreadChat: 3 })
    store().setPanel('chat' as never)
    expect(store()).toMatchObject({ panel: 'chat', unreadChat: 0 })
    store().togglePin('k')
    expect(store().pinnedKey).toBe('k')
    store().togglePin('k')
    expect(store().pinnedKey).toBeNull()
    store().setAudioOutput('spk')
    expect(store().audioOutputId).toBe('spk')
    store().setLayout('grid' as never)
    expect(store().layout).toBe('grid')
    store().reset()
    expect(store().audioOutputId).toBeUndefined()
    expect(store().phase).toBe('loading')
  })
})
