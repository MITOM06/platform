/** SfuGroupCall used directly (the façade suite drives it through groupCallManager). */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'

const m = vi.hoisted(() => {
  class MediaAccessError extends Error {}
  class FakeSession {
    static all: FakeSession[] = []
    static connectImpl: (() => Promise<void>) | null = null
    onLocalStream: ((s: MediaStream) => void) | null = null
    onPeersChanged: ((p: { identity: string; speaking: boolean }[]) => void) | null = null
    onReconnecting: ((on: boolean) => void) | null = null
    onLocalPoorConnection: ((p: boolean) => void) | null = null
    onDisconnected: ((r: 'failed' | 'ended') => void) | null = null
    peers = new Map<string, { stream: unknown }>()
    connect = vi.fn(async () => { const f = FakeSession.connectImpl; FakeSession.connectImpl = null; if (f) await f() })
    disconnect = vi.fn()
    setMic = vi.fn(async () => {})
    setCamera = vi.fn(async () => {})
    localStream = () => ({ id: 'local' })
    peer = (id: string) => this.peers.get(id)
    constructor() { FakeSession.all.push(this) }
  }
  return { FakeSession, MediaAccessError, publish: vi.fn(), getToken: vi.fn() }
})
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish: m.publish } }))
vi.mock('@/lib/api/calls', () => ({ callsApi: { getToken: m.getToken } }))
vi.mock('@/lib/rtc/livekit-session', () => ({ LiveKitSession: m.FakeSession, MediaAccessError: m.MediaAccessError }))

import { SfuGroupCall } from '../sfu-group-call'
import { useCallStore } from '@/lib/store/call.store'
import type { GroupCallHooks } from '../call-hooks'

const initial = useCallStore.getState()
let hooks: GroupCallHooks & { onJoinError: Mock<(n: string) => void> }
const last = () => m.FakeSession.all.at(-1)!

beforeEach(() => {
  useCallStore.setState(initial, true)
  m.FakeSession.all = []
  m.FakeSession.connectImpl = null
  m.publish.mockReset()
  m.getToken.mockReset().mockResolvedValue({ url: 'wss://lk', token: 'tok' })
  hooks = { onLocalStream: vi.fn(), onEnded: vi.fn(), onJoinError: vi.fn() }
})

describe('SfuGroupCall', () => {
  it('start → call.start, then its own call.started enters the room', async () => {
    const g = new SfuGroupCall(hooks)
    expect(g.isActive()).toBe(false)
    expect(g.getLocalStream()).toBeNull()
    expect(g.getRemoteStream('p')).toBeNull()
    await g.startCall('c1', 'me', 'video', true)
    expect(m.publish).toHaveBeenCalledWith('/app/call.start', { conversationId: 'c1', media: 'video', aiNotetaker: true })
    await g.confirmStarted('k1', 'c1', 'me', 'video', true)
    expect(g.isActive()).toBe(true)
    expect(useCallStore.getState()).toMatchObject({ groupCallId: 'k1', groupTransport: 'sfu' })
    expect(g.getLocalStream()).toEqual({ id: 'local' })
    last().peers.set('p', { stream: 'S' })
    expect(g.getRemoteStream('p')).toBe('S')
    await g.confirmStarted('k2', 'c1', 'me', 'video', true)
    expect(m.getToken).toHaveBeenCalledTimes(1)
  })

  it('confirmStarted without our own start does nothing; join accepts once', async () => {
    const g = new SfuGroupCall(hooks)
    await g.confirmStarted('k1', 'c1', 'me', 'audio', false)
    expect(g.isActive()).toBe(false)
    await g.join('k1', 'c1', 'me', 'audio', false)
    await g.join('k1', 'c1', 'me', 'audio', false)
    expect(m.publish.mock.calls.filter((c) => c[0] === '/app/call.accept')).toHaveLength(1)
  })

  it('token failure explains it and leaves', async () => {
    const e = new AxiosError('x')
    e.response = { status: 503, data: { code: 'CALLS_UNAVAILABLE' } } as AxiosResponse
    m.getToken.mockRejectedValueOnce(e)
    const g = new SfuGroupCall(hooks)
    await g.join('k1', 'c1', 'me', 'audio', false)
    expect(hooks.onJoinError).toHaveBeenCalledWith('errUnavailable')
    expect(m.publish).toHaveBeenCalledWith('/app/call.leave', { callId: 'k1' })
    expect(g.isActive()).toBe(false)
  })

  it('leaving while the token loads stops the join', async () => {
    let resolve!: (v: unknown) => void
    m.getToken.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const g = new SfuGroupCall(hooks)
    const p = g.join('k1', 'c1', 'me', 'audio', false)
    g.leave()
    resolve({ url: 'u', token: 't' })
    await p
    expect(m.FakeSession.all).toHaveLength(0)
  })

  it('connect errors: media → mediaError, other → errFailed', async () => {
    m.FakeSession.connectImpl = async () => { throw new m.MediaAccessError() }
    await new SfuGroupCall(hooks).join('k1', 'c1', 'me', 'audio', false)
    expect(hooks.onJoinError).toHaveBeenLastCalledWith('mediaError')
    m.FakeSession.connectImpl = async () => { throw new Error('ws') }
    await new SfuGroupCall(hooks).join('k2', 'c1', 'me', 'audio', false)
    expect(hooks.onJoinError).toHaveBeenLastCalledWith('errFailed')
  })

  it('room callbacks: local stream, peers, reconnecting, poor network, disconnect', async () => {
    const g = new SfuGroupCall(hooks)
    await g.join('k1', 'c1', 'me', 'audio', false)
    const s = last()
    s.onLocalStream!({} as MediaStream)
    expect(hooks.onLocalStream).toHaveBeenCalled()
    const v = useCallStore.getState().streamsVersion
    s.onPeersChanged!([])
    expect(useCallStore.getState().groupActive).toBe(false)
    s.onPeersChanged!([{ identity: 'a', speaking: true }, { identity: 'b', speaking: false }])
    expect(useCallStore.getState().groupActive).toBe(true)
    expect(useCallStore.getState().streamsVersion).toBe(v + 2)
    s.onReconnecting!(true)
    s.onLocalPoorConnection!(true)
    expect(useCallStore.getState()).toMatchObject({ reconnecting: true, poorConnection: true })
    s.onDisconnected!('failed')
    expect(m.publish).toHaveBeenCalledWith('/app/call.leave', { callId: 'k1' })
    expect(hooks.onEnded).toHaveBeenCalled()
  })

  it('room closed by the server tears down without leave; stale sessions are ignored', async () => {
    const g = new SfuGroupCall(hooks)
    await g.join('k1', 'c1', 'me', 'audio', false)
    const s = last()
    s.onDisconnected!('ended')
    expect(m.publish.mock.calls.some((c) => c[0] === '/app/call.leave')).toBe(false)
    expect(g.isActive()).toBe(false)
    s.onDisconnected!('failed')
    expect(m.publish.mock.calls.some((c) => c[0] === '/app/call.leave')).toBe(false)
  })

  it('mic / camera changes: store only before joining, then sent to the room', async () => {
    const g = new SfuGroupCall(hooks)
    g.toggleMic(false)
    expect(useCallStore.getState().micEnabled).toBe(false)
    await g.join('k0', 'c1', 'me', 'video', false)
    const asked = last().connect.mock.calls[0] as unknown as [string, string, { video: boolean; audio: boolean }]
    m.FakeSession.connectImpl = async () => {
      useCallStore.setState({ micEnabled: !asked[2].audio, cameraEnabled: !asked[2].video } as never)
    }
    g.handleEnded('k0')
    await g.join('k1', 'c1', 'me', 'video', false)
    expect(last().setMic).toHaveBeenCalledWith(!asked[2].audio)
    expect(last().setCamera).toHaveBeenCalledWith(!asked[2].video)
    last().setCamera.mockRejectedValueOnce(new Error('refused'))
    g.toggleCamera(false)
    g.toggleMic(false)
    expect(last().setMic).toHaveBeenLastCalledWith(false)
    g.applyRoster([{ userId: 'a' }] as never)
    expect(useCallStore.getState().roster).toEqual([{ userId: 'a' }])
    g.handleEnded('other')
    expect(g.isActive()).toBe(true)
    g.handleEnded('k1')
    expect(g.isActive()).toBe(false)
    g.applyRoster([{ userId: 'b' }] as never)
  })
})
