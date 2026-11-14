import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'

const m = vi.hoisted(() => {
  class MediaAccessError extends Error {}
  class FakeSession {
    static all: FakeSession[] = []
    static connectImpl: (() => Promise<void>) | null = null
    onLocalStream: ((s: MediaStream) => void) | null = null
    onPeersChanged: (() => void) | null = null
    onReconnecting: ((on: boolean) => void) | null = null
    onLocalPoorConnection: ((p: boolean) => void) | null = null
    onDisconnected: ((r: 'failed' | 'ended') => void) | null = null
    peers = new Map<string, unknown>()
    local = { id: 'local' }
    connect = vi.fn(async () => { const f = FakeSession.connectImpl; FakeSession.connectImpl = null; if (f) await f() })
    disconnect = vi.fn()
    setMic = vi.fn(async () => {})
    setCamera = vi.fn(async () => {})
    localStream = () => this.local
    peer = (id: string) => this.peers.get(id)
    constructor() { FakeSession.all.push(this) }
  }
  return { FakeSession, MediaAccessError, getToken: vi.fn(), refresh: vi.fn() }
})
vi.mock('@/lib/rtc/livekit-session', () => ({ LiveKitSession: m.FakeSession, MediaAccessError: m.MediaAccessError }))
vi.mock('@/lib/api/calls', () => ({ callsApi: { getToken: m.getToken } }))
vi.mock('../call-transport', () => ({ refreshCallTransport: m.refresh }))

import { SfuCallRoom, type SfuRoomOwner } from '../sfu-call-room'
import { useCallStore } from '@/lib/store/call.store'
import { RECONNECT_BLIP_MS } from '../call-config'

const initial = useCallStore.getState()
let callId: string | null
type Fn = Mock<(...a: never[]) => void>
let owner: SfuRoomOwner & { fail: Fn; roomClosed: Fn; peerPresent: Fn }

const httpErr = (status: number, code?: string) => {
  const e = new AxiosError('x')
  e.response = { status, data: code ? { code } : {} } as AxiosResponse
  return e
}
const last = () => m.FakeSession.all.at(-1)!

beforeEach(() => {
  vi.useFakeTimers()
  useCallStore.setState(initial, true)
  useCallStore.setState({ peerId: 'bob', micEnabled: true, cameraEnabled: false } as never)
  m.FakeSession.all = []
  m.FakeSession.connectImpl = null
  m.getToken.mockReset().mockResolvedValue({ url: 'wss://lk', token: 'tok' })
  m.refresh.mockReset()
  callId = 'call1'
  owner = {
    hooks: { onLocalStream: vi.fn(), onRemoteStream: vi.fn(), onEnded: null, onEndNotice: null },
    currentCallId: () => callId,
    fail: vi.fn(), roomClosed: vi.fn(), peerPresent: vi.fn(),
  }
})
afterEach(() => vi.useRealTimers())

describe('join', () => {
  it('connects with the store choice and exposes streams', async () => {
    const room = new SfuCallRoom(owner)
    expect(room.localStream()).toBeNull()
    expect(room.remoteStream()).toBeNull()
    await room.join('call1')
    expect(m.getToken).toHaveBeenCalledWith('call1')
    expect(last().connect).toHaveBeenCalledWith('wss://lk', 'tok', { video: false, audio: true })
    expect(room.localStream()).toEqual({ id: 'local' })
    const stream = { getVideoTracks: () => [] }
    last().peers.set('bob', { stream, poorConnection: false, camMuted: false })
    expect(room.remoteStream()).toBe(stream)
  })

  it('token failure fails the call with the mapped notice; CALL_NOT_SFU refreshes the transport', async () => {
    m.getToken.mockRejectedValueOnce(httpErr(409, 'CALL_ENDED'))
    await new SfuCallRoom(owner).join('call1')
    expect(owner.fail).toHaveBeenLastCalledWith('failed', 'errEnded')
    m.getToken.mockRejectedValueOnce(httpErr(409, 'CALL_NOT_SFU'))
    await new SfuCallRoom(owner).join('call1')
    expect(m.refresh).toHaveBeenCalled()
    expect(owner.fail).toHaveBeenLastCalledWith('failed', 'errNotSfu')
  })

  it('token failure on a rejoin or for a call that ended is silent', async () => {
    m.getToken.mockRejectedValue(new Error('x'))
    await new SfuCallRoom(owner).join('call1', true)
    callId = 'other'
    await new SfuCallRoom(owner).join('call1')
    expect(owner.fail).not.toHaveBeenCalled()
  })

  it('the call ending while fetching the token stops the join', async () => {
    m.getToken.mockImplementationOnce(async () => { callId = null; return { url: 'u', token: 't' } })
    await new SfuCallRoom(owner).join('call1')
    expect(m.FakeSession.all).toHaveLength(0)
  })

  it('connect errors: media → media_error, others → errFailed, silent on rejoin', async () => {
    m.FakeSession.connectImpl = async () => { throw new m.MediaAccessError('denied') }
    await new SfuCallRoom(owner).join('call1')
    expect(owner.fail).toHaveBeenLastCalledWith('media_error')
    m.FakeSession.connectImpl = async () => { throw new Error('ws') }
    await new SfuCallRoom(owner).join('call1')
    expect(owner.fail).toHaveBeenLastCalledWith('failed', 'errFailed')
    m.FakeSession.connectImpl = async () => { throw new Error('ws') }
    await new SfuCallRoom(owner).join('call1', true)
    expect(owner.fail).toHaveBeenCalledTimes(2)
  })

  it('changes made while connecting are applied after; set* before joining wait', async () => {
    const room = new SfuCallRoom(owner)
    room.setMic(false)
    room.setCamera(true)
    m.FakeSession.connectImpl = async () => { useCallStore.setState({ micEnabled: false, cameraEnabled: true } as never) }
    await room.join('call1')
    expect(last().setMic).toHaveBeenCalledWith(false)
    expect(last().setCamera).toHaveBeenCalledWith(true)
    last().setMic.mockRejectedValueOnce(new Error('refused'))
    room.setMic(true)
    room.setCamera(false)
    await Promise.resolve()
    expect(last().setCamera).toHaveBeenLastCalledWith(false)
  })

  it('a newer join supersedes one still connecting', async () => {
    const room = new SfuCallRoom(owner)
    let release!: () => void
    m.FakeSession.connectImpl = () => new Promise<void>((r) => { release = r })
    const first = room.join('call1')
    await vi.waitFor(() => expect(m.FakeSession.all).toHaveLength(1))
    const firstSession = last()
    await room.join('call1')
    release()
    await first
    expect(firstSession.disconnect).toHaveBeenCalled()
    room.setMic(false)
    expect(firstSession.setMic).not.toHaveBeenCalled()
    expect(last().setMic).toHaveBeenCalledWith(false)
  })
})

describe('session callbacks', () => {
  it('local stream, poor connection and reconnecting are forwarded', async () => {
    const room = new SfuCallRoom(owner)
    await room.join('call1')
    const s = last()
    s.onLocalStream!({} as MediaStream)
    expect(owner.hooks.onLocalStream).toHaveBeenCalled()
    s.onLocalPoorConnection!(true)
    expect(useCallStore.getState().poorConnection).toBe(true)
    s.onReconnecting!(true)
    expect(useCallStore.getState().reconnecting).toBe(true)
    s.onReconnecting!(false)
    expect(useCallStore.getState().reconnecting).toBe(false)
    vi.advanceTimersByTime(RECONNECT_BLIP_MS + 1)
    expect(owner.fail).not.toHaveBeenCalled()
  })

  it('ended → roomClosed; failed → rejoin with a fresh session; detached sessions are ignored', async () => {
    const room = new SfuCallRoom(owner)
    await room.join('call1')
    const s = last()
    s.onDisconnected!('ended')
    expect(owner.roomClosed).toHaveBeenCalledWith('call1')
    s.onDisconnected!('failed')
    await vi.advanceTimersByTimeAsync(4_100)
    expect(m.getToken).toHaveBeenCalledTimes(2)
    expect(m.FakeSession.all.length).toBeGreaterThanOrEqual(2)
    const count = owner.roomClosed.mock.calls.length
    s.onDisconnected!('ended')
    expect(owner.roomClosed).toHaveBeenCalledTimes(count)
    room.close()
  })

  it('rejoin waits while offline or after the call changed', async () => {
    const room = new SfuCallRoom(owner)
    await room.join('call1')
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    last().onDisconnected!('failed')
    await vi.advanceTimersByTimeAsync(4_100)
    expect(m.getToken).toHaveBeenCalledTimes(1)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    callId = 'other'
    await vi.advanceTimersByTimeAsync(4_100)
    expect(m.getToken).toHaveBeenCalledTimes(1)
    room.close()
  })

  it('peer presence: present → peerPresent + remote stream once; camera state follows', async () => {
    const room = new SfuCallRoom(owner)
    await room.join('call1')
    const s = last()
    const stream = { getVideoTracks: () => [{}] }
    s.peers.set('bob', { stream, poorConnection: true, camMuted: false })
    s.onPeersChanged!()
    expect(owner.peerPresent).toHaveBeenCalled()
    expect(owner.hooks.onRemoteStream).toHaveBeenCalledWith(stream)
    expect(useCallStore.getState()).toMatchObject({ peerPoor: true, peerCamera: true, video: true })
    s.onPeersChanged!()
    expect(owner.hooks.onRemoteStream).toHaveBeenCalledTimes(1)
  })
})
