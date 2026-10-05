import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => {
  class MediaAccessError extends Error {}
  class FakeSession {
    static last: FakeSession | null = null
    static connectError: Error | null = null
    onLocalStream: ((s: MediaStream) => void) | null = null
    onPeersChanged: (() => void) | null = null
    onReconnecting: ((on: boolean) => void) | null = null
    onLocalPoorConnection: ((poor: boolean) => void) | null = null
    onDisconnected: ((r: 'failed') => void) | null = null
    peersById = new Map<string, { identity: string; stream: { getTracks: () => unknown[] } }>()
    connect = vi.fn(async (_url: string, _token: string, _opts: { video: boolean }) => {
      const e = FakeSession.connectError
      FakeSession.connectError = null
      if (e) throw e
    })
    disconnect = vi.fn()
    setMic = vi.fn(async (_on: boolean) => {})
    setCamera = vi.fn(async (_on: boolean) => {})
    localStream = () => null
    peer = (id: string) => this.peersById.get(id)
    constructor() {
      FakeSession.last = this
    }
    /** Simulate someone joining the room. */
    join(identity: string) {
      this.peersById.set(identity, { identity, stream: { getTracks: () => [{}] } })
      this.onPeersChanged?.()
    }
  }
  return {
    FakeSession,
    MediaAccessError,
    publish: vi.fn(),
    sendMessage: vi.fn(() => Promise.resolve()),
    getToken: vi.fn(async (_callId: string) => ({ url: 'wss://rtc', token: 'tok' })),
  }
})
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish: m.publish } }))
vi.mock('@/lib/api/chat', () => ({ chatService: { sendMessage: m.sendMessage } }))
vi.mock('@/lib/api/calls', () => ({ callsApi: { getToken: m.getToken } }))
vi.mock('@/lib/rtc/livekit-session', () => ({
  LiveKitSession: m.FakeSession,
  MediaAccessError: m.MediaAccessError,
}))

import { SfuDirectCall } from '../sfu-call'
import { RING_TIMEOUT_MS } from '../call-config'
import { useCallStore } from '@/lib/store/call.store'

const hooks = {
  onLocalStream: vi.fn(),
  onRemoteStream: vi.fn(),
  onEnded: vi.fn(),
  onEndNotice: vi.fn(),
}
const getUserMedia = vi.fn()
let call: SfuDirectCall
const store = () => useCallStore.getState()
const sent = (dest: string) => m.publish.mock.calls.filter(([d]) => d === dest).map(([, body]) => body)
const flush = () => vi.advanceTimersByTimeAsync(0)
const started = (callId = 'c1', conversationId = 'conv') =>
  call.handleCallEvent({
    event: 'call.started',
    callId,
    conversationId,
    media: 'audio',
    aiNotetaker: false,
    startedBy: 'me',
    startedByName: 'me',
    participants: [],
    transport: 'sfu',
    kind: 'direct',
  })
const ring = (callId = 'c1') =>
  call.handleSignal({
    type: 'call-ring',
    callId,
    conversationId: 'conv',
    senderId: 'alice',
    media: 'audio',
    transport: 'sfu',
    kind: 'direct',
  })

beforeEach(() => {
  vi.useFakeTimers()
  useCallStore.getState().reset()
  useCallStore.getState().resetGroup()
  m.publish.mockClear()
  m.sendMessage.mockClear()
  m.getToken.mockClear()
  m.FakeSession.last = null
  Object.values(hooks).forEach((h) => h.mockClear())
  getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  call = new SfuDirectCall(hooks)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('outgoing', () => {
  it('starts on the server, then joins the room once the call id arrives', async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    expect(store().status).toBe('outgoing')
    expect(store().transport).toBe('sfu')
    expect(sent('/app/call.start')).toEqual([{ conversationId: 'conv', media: 'audio' }])

    started()
    await flush()
    expect(m.getToken).toHaveBeenCalledWith('c1')
    expect(m.FakeSession.last!.connect).toHaveBeenCalledWith('wss://rtc', 'tok', { video: false })
  })

  it('is connected when the other person enters the room', async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    started()
    await flush()
    m.FakeSession.last!.join('bob')
    expect(store().status).toBe('connected')
    expect(hooks.onRemoteStream).toHaveBeenCalled()
    vi.advanceTimersByTime(RING_TIMEOUT_MS)
    expect(sent('/app/call.cancel')).toEqual([])
  })

  it('gives up after the ring timeout', async () => {
    await call.startCall('bob', 'Bob', 'conv', true)
    started()
    await flush()
    vi.advanceTimersByTime(RING_TIMEOUT_MS)
    expect(sent('/app/call.cancel')).toEqual([{ callId: 'c1', reason: 'no_answer' }])
    expect(hooks.onEndNotice).toHaveBeenCalledWith('no_answer', false, 'Bob')
    expect(m.sendMessage).toHaveBeenCalledWith('conv', 'system.call.missed:video', 'system')
    expect(store().status).toBe('idle')
  })

  it('cancels as soon as the call id arrives when hung up before it', async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    call.endCall('hangup')
    expect(sent('/app/call.cancel')).toEqual([])
    started()
    await flush()
    expect(sent('/app/call.cancel')).toEqual([{ callId: 'c1', reason: 'hangup' }])
    expect(m.FakeSession.last).toBeNull()
  })

  it('reports a busy callee and logs a missed call', async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    call.handleSignal({ type: 'call-declined', conversationId: 'conv', reason: 'busy', senderId: 'bob' })
    expect(hooks.onEndNotice).toHaveBeenCalledWith('busy', true, 'Bob')
    expect(m.sendMessage).toHaveBeenCalledWith('conv', 'system.call.missed:voice', 'system')
    expect(store().status).toBe('idle')
  })

  it('reports a decline', async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    started()
    await flush()
    call.handleSignal({ type: 'call-declined', callId: 'c1', conversationId: 'conv', reason: 'declined' })
    expect(hooks.onEndNotice).toHaveBeenCalledWith('declined', true, 'Bob')
    expect(m.FakeSession.last!.disconnect).toHaveBeenCalled()
  })

  it('a token failure ends the attempt instead of hanging on Calling', async () => {
    m.getToken.mockRejectedValueOnce(new Error('503'))
    await call.startCall('bob', 'Bob', 'conv', false)
    started()
    await flush()
    expect(hooks.onEndNotice).toHaveBeenCalledWith('failed', false, 'Bob')
    expect(store().status).toBe('idle')
  })
})

describe('incoming', () => {
  it('rings when free', () => {
    ring()
    expect(store().status).toBe('incoming')
    expect(store().callId).toBe('c1')
    expect(store().peerId).toBe('alice')
  })

  it('answers busy without disturbing the current call', async () => {
    await call.startCall('bob', 'Bob', 'conv-2', false)
    ring('c9')
    expect(sent('/app/call.decline')).toEqual([{ callId: 'c9', reason: 'busy' }])
    expect(store().status).toBe('outgoing')
  })

  it('accepting joins the room and ignores its own answered-elsewhere echo', async () => {
    ring()
    await call.acceptIncoming()
    expect(sent('/app/call.accept')).toEqual([{ callId: 'c1' }])
    call.handleSignal({ type: 'call-ring-cancel', callId: 'c1', reason: 'answered_elsewhere' })
    await flush()
    expect(m.FakeSession.last!.connect).toHaveBeenCalled()
    m.FakeSession.last!.join('alice')
    expect(store().status).toBe('connected')
  })

  it('stops ringing when another device answered or the caller gave up', () => {
    ring()
    call.handleSignal({ type: 'call-ring-cancel', callId: 'c1', reason: 'answered_elsewhere' })
    expect(store().status).toBe('idle')
    expect(hooks.onEndNotice).not.toHaveBeenCalled()
  })

  it('declines with media_error when the mic is blocked, before accepting', async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
    ring()
    await call.acceptIncoming()
    expect(sent('/app/call.accept')).toEqual([])
    expect(sent('/app/call.decline')).toEqual([{ callId: 'c1', reason: 'media_error' }])
    expect(hooks.onEndNotice).toHaveBeenCalledWith('media_error', false, '')
  })

  it('declining tells the server and logs a missed call', () => {
    ring()
    call.endCall('declined')
    expect(sent('/app/call.decline')).toEqual([{ callId: 'c1', reason: 'declined' }])
    expect(m.sendMessage).toHaveBeenCalledWith('conv', 'system.call.missed:voice', 'system')
  })
})

describe('in a call', () => {
  const connect = async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    started()
    await flush()
    m.FakeSession.last!.join('bob')
  }

  it('hanging up leaves and logs the duration; the echo of call.ended is silent', async () => {
    await connect()
    useCallStore.getState().setDuration(65)
    call.endCall('hangup')
    expect(sent('/app/call.leave')).toEqual([{ callId: 'c1' }])
    expect(m.sendMessage).toHaveBeenCalledWith('conv', 'system.call.ended:voice:65', 'system')
    hooks.onEndNotice.mockClear()
    call.handleCallEvent({ event: 'call.ended', callId: 'c1', reason: 'hangup' })
    expect(hooks.onEndNotice).not.toHaveBeenCalled()
  })

  it('the other side hanging up ends it with a notice', async () => {
    await connect()
    call.handleCallEvent({ event: 'call.ended', callId: 'c1', reason: 'hangup' })
    expect(hooks.onEndNotice).toHaveBeenCalledWith('hangup', true, 'Bob')
    expect(store().status).toBe('idle')
  })

  it('shows reconnecting, and a real drop ends the call as failed', async () => {
    await connect()
    const session = m.FakeSession.last!
    session.onReconnecting!(true)
    expect(store().reconnecting).toBe(true)
    session.onReconnecting!(false)
    expect(store().reconnecting).toBe(false)
    session.onDisconnected!('failed')
    expect(sent('/app/call.leave')).toEqual([{ callId: 'c1' }])
    expect(hooks.onEndNotice).toHaveBeenCalledWith('failed', false, 'Bob')
  })

  it('toggles mic and camera on the session', async () => {
    await connect()
    call.toggleMic(false)
    call.toggleCamera(true)
    expect(m.FakeSession.last!.setMic).toHaveBeenCalledWith(false)
    expect(m.FakeSession.last!.setCamera).toHaveBeenCalledWith(true)
    expect(store().micEnabled).toBe(false)
  })
})
