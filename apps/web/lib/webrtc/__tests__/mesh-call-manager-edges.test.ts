/** MeshCallManager paths the façade tests (call-manager.test.ts) never reach. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { publish, sendMessage } = vi.hoisted(() => ({ publish: vi.fn(), sendMessage: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish, isConnected: () => true } }))
vi.mock('@/lib/api/chat', () => ({ chatService: { sendMessage } }))

import { MeshCallManager } from '../mesh-call-manager'
import { useCallStore } from '@/lib/store/call.store'
import type { CallHooks } from '../call-hooks'

class FakePC {
  static last: FakePC | null = null
  connectionState = 'new'
  signalingState = 'stable'
  onicecandidate: ((e: { candidate: { toJSON(): unknown } | null }) => void) | null = null
  ontrack: ((e: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  addTrack = vi.fn()
  close = vi.fn()
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0' }))
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'v=0' }))
  setLocalDescription = vi.fn(async (d: { type: string }) => { this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable' })
  setRemoteDescription = vi.fn(async (_d: { type: string }) => { this.signalingState = 'stable' })
  addIceCandidate = vi.fn(async () => {})
  getTransceivers = () => []
  getStats = vi.fn(async () => new Map())
  constructor() { FakePC.last = this }
  goTo(s: string) { this.connectionState = s; this.onconnectionstatechange?.() }
}

const stopTrack = vi.fn()
const localStream = { getTracks: () => [{ stop: stopTrack }], getAudioTracks: () => [], getVideoTracks: () => [] }
const getUserMedia = vi.fn()
let hooks: CallHooks
const initial = useCallStore.getState()
const ends = () => publish.mock.calls.filter((c) => c[0] === '/app/call.end').map((c) => c[1])

beforeEach(() => {
  vi.useFakeTimers()
  publish.mockReset(); sendMessage.mockClear(); stopTrack.mockReset()
  getUserMedia.mockReset().mockResolvedValue(localStream)
  vi.stubGlobal('RTCPeerConnection', FakePC)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  useCallStore.setState(initial, true)
  hooks = { onLocalStream: vi.fn(), onRemoteStream: vi.fn(), onEnded: vi.fn(), onEndNotice: vi.fn() }
  FakePC.last = null
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

const incoming = (m: MeshCallManager, sdp = 'v=0\r\nm=audio 9') =>
  m.handleSignal({ type: 'offer', senderId: 'bob', conversationId: 'c1', sdp } as never)

describe('startCall', () => {
  it('exposes the local stream and relays ICE candidates', async () => {
    const m = new MeshCallManager(hooks)
    await m.startCall('bob', 'Bob', 'c1', false)
    expect(m.getLocalStream()).toBe(localStream)
    expect(m.getRemoteStream()).toBeNull()
    FakePC.last!.onicecandidate!({ candidate: { toJSON: () => ({ candidate: 'x' }) } })
    FakePC.last!.onicecandidate!({ candidate: null })
    expect(publish.mock.calls.filter((c) => c[0] === '/app/call.ice')).toEqual([
      ['/app/call.ice', { targetId: 'bob', conversationId: 'c1', type: 'ice', candidate: { candidate: 'x' } }],
    ])
  })

  it('media failure resets the UI and rethrows', async () => {
    getUserMedia.mockRejectedValue(new Error('NotAllowed'))
    const m = new MeshCallManager(hooks)
    await expect(m.startCall('bob', 'Bob', 'c1')).rejects.toThrow('NotAllowed')
    expect(useCallStore.getState().status).toBe('idle')
    expect(hooks.onEnded).toHaveBeenCalled()
    expect(ends()).toEqual([])
  })

  it('hanging up while the mic opens resolves quietly and releases the late stream', async () => {
    let resolve!: (s: unknown) => void
    getUserMedia.mockReturnValue(new Promise((r) => { resolve = r }))
    const m = new MeshCallManager(hooks)
    const p = m.startCall('bob', 'Bob', 'c1')
    m.endCall()
    resolve(localStream)
    await expect(p).resolves.toBeUndefined()
    expect(stopTrack).toHaveBeenCalled()
  })

  it('remote tracks: ignored without any stream, joined into the existing remote stream later', async () => {
    const m = new MeshCallManager(hooks)
    await m.startCall('bob', 'Bob', 'c1', false)
    const pc = FakePC.last!
    pc.ontrack!({ streams: [], track: {} as MediaStreamTrack })
    expect(hooks.onRemoteStream).not.toHaveBeenCalled()
    const tracks: unknown[] = []
    const remote = { getTracks: () => tracks, addTrack: vi.fn((t) => tracks.push(t)) } as unknown as MediaStream
    pc.ontrack!({ streams: [remote], track: {} as MediaStreamTrack })
    expect(m.getRemoteStream()).toBe(remote)
    expect(useCallStore.getState().status).toBe('connected')
    const video = { kind: 'video' } as MediaStreamTrack
    pc.ontrack!({ streams: [], track: video })
    expect(remote.addTrack).toHaveBeenCalledWith(video)
    pc.ontrack!({ streams: [], track: video })
    expect(remote.addTrack).toHaveBeenCalledTimes(1)
  })

  it('a connection that fails before ever connecting ends the call as failed', async () => {
    const m = new MeshCallManager(hooks)
    await m.startCall('bob', 'Bob', 'c1', false)
    FakePC.last!.goTo('disconnected')
    expect(useCallStore.getState().status).toBe('outgoing')
    FakePC.last!.goTo('failed')
    expect(ends().at(-1)).toMatchObject({ targetId: 'bob', reason: 'failed' })
    expect(hooks.onEndNotice).toHaveBeenCalledWith('failed', false, 'Bob')
  })

  it('a late / duplicate answer is ignored; a broken answer is swallowed', async () => {
    const m = new MeshCallManager(hooks)
    m.handleSignal({ type: 'answer', sdp: 'x' } as never)
    await m.startCall('bob', 'Bob', 'c1', false)
    const pc = FakePC.last!
    pc.setRemoteDescription.mockRejectedValueOnce(new Error('bad'))
    m.handleSignal({ type: 'answer' } as never)
    await vi.runOnlyPendingTimersAsync()
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: '' })
    pc.signalingState = 'stable'
    m.handleSignal({ type: 'answer', sdp: 'again' } as never)
    expect(pc.setRemoteDescription).toHaveBeenCalledTimes(1)
  })
})

describe('incoming', () => {
  it('offers missing a sender, conversation or sdp are dropped', () => {
    const m = new MeshCallManager(hooks)
    m.handleSignal({ type: 'offer', conversationId: 'c1', sdp: 's' } as never)
    m.handleSignal({ type: 'offer', senderId: 'bob', sdp: 's' } as never)
    m.handleSignal({ type: 'offer', senderId: 'bob', conversationId: 'c1' } as never)
    expect(useCallStore.getState().status).toBe('idle')
  })

  it('acceptIncoming without a pending offer does nothing', async () => {
    const m = new MeshCallManager(hooks)
    await m.acceptIncoming()
    expect(FakePC.last).toBeNull()
  })

  it('mic refused on answer → tells the caller media_error', async () => {
    getUserMedia.mockRejectedValue(new Error('NotAllowed'))
    const m = new MeshCallManager(hooks)
    incoming(m)
    await m.acceptIncoming()
    expect(ends().at(-1)).toMatchObject({ targetId: 'bob', conversationId: 'c1', reason: 'media_error' })
    expect(useCallStore.getState().status).toBe('idle')
  })

  it('an unusable offer ends the call as failed', async () => {
    const m = new MeshCallManager(hooks)
    incoming(m)
    const pending = m.acceptIncoming()
    await vi.waitFor(() => expect(FakePC.last).not.toBeNull())
    FakePC.last!.setRemoteDescription.mockRejectedValueOnce(new Error('bad sdp'))
    await pending
    expect(ends().at(-1)).toMatchObject({ reason: 'failed' })
  })

  it('answering a video offer opens the camera; a second click is ignored', async () => {
    const m = new MeshCallManager(hooks)
    incoming(m, 'v=0\r\nm=audio 9\r\nm=video 9')
    await m.acceptIncoming()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: true })
    await m.acceptIncoming()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledWith('/app/call.answer', expect.objectContaining({ targetId: 'bob', type: 'answer' }))
  })

  it('a remote end while idle, or from a stranger, changes nothing', async () => {
    const m = new MeshCallManager(hooks)
    m.handleSignal({ type: 'end', senderId: 'bob' } as never)
    expect(hooks.onEnded).not.toHaveBeenCalled()
    incoming(m)
    m.handleSignal({ type: 'end', senderId: 'eve' } as never)
    expect(useCallStore.getState().status).toBe('incoming')
    m.handleSignal({ type: 'end', senderId: 'bob', reason: 'hangup' } as never)
    expect(useCallStore.getState().status).toBe('idle')
    expect(hooks.onEndNotice).not.toHaveBeenCalled()
  })

  it('answered-elsewhere stops ringing only for the matching call', () => {
    const m = new MeshCallManager(hooks)
    incoming(m)
    m.handleSignal({ type: 'answered-elsewhere', senderId: 'bob', conversationId: 'other' } as never)
    expect(useCallStore.getState().status).toBe('incoming')
    m.handleSignal({ type: 'answered-elsewhere', senderId: 'bob', conversationId: 'c1' } as never)
    expect(useCallStore.getState().status).toBe('idle')
  })
})
