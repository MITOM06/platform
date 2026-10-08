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
    peersById = new Map<
      string,
      {
        identity: string
        stream: { getTracks: () => unknown[]; getVideoTracks: () => unknown[] }
        poorConnection: boolean
        camMuted: boolean
      }
    >()
    connect = vi.fn<(url: string, token: string, opts: { video: boolean }) => Promise<unknown>>(async () => {
      const e = FakeSession.connectError
      FakeSession.connectError = null
      if (e) throw e
    })
    disconnect = vi.fn()
    setMic = vi.fn<(on: boolean) => Promise<unknown>>(async () => {})
    setCamera = vi.fn<(on: boolean) => Promise<unknown>>(async () => {})
    localStream = () => null
    peer = (id: string) => this.peersById.get(id)
    constructor() {
      FakeSession.last = this
    }
    /** Simulate someone joining the room (or their state changing). */
    join(identity: string, opts: { video?: boolean; poor?: boolean; camMuted?: boolean } = {}) {
      const prev = this.peersById.get(identity)
      const stream = prev?.stream ?? {
        getTracks: () => [{}],
        getVideoTracks: () => (opts.video ? [{}] : []),
      }
      if (prev && opts.video !== undefined) stream.getVideoTracks = () => (opts.video ? [{}] : [])
      this.peersById.set(identity, {
        identity,
        stream,
        poorConnection: opts.poor ?? false,
        camMuted: opts.camMuted ?? false,
      })
      this.onPeersChanged?.()
    }
    /** Simulate someone leaving the room. */
    leave(identity: string) {
      this.peersById.delete(identity)
      this.onPeersChanged?.()
    }
  }
  const subs = new Map<string, (frame: { body: string }) => void>()
  return {
    FakeSession,
    MediaAccessError,
    subs,
    subscribe: vi.fn((dest: string, cb: (frame: { body: string }) => void) => {
      subs.set(dest, cb)
      return { unsubscribe: vi.fn(() => subs.delete(dest)) }
    }),
    publish: vi.fn(),
    sendMessage: vi.fn(() => Promise.resolve()),
    getToken: vi.fn<(callId: string) => Promise<unknown>>(async () => ({ url: 'wss://rtc', token: 'tok' })),
  }
})
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish: m.publish, subscribe: m.subscribe } }))
vi.mock('@/lib/api/chat', () => ({ chatService: { sendMessage: m.sendMessage } }))
vi.mock('@/lib/api/calls', () => ({ callsApi: { getToken: m.getToken } }))
vi.mock('@/lib/rtc/livekit-session', () => ({
  LiveKitSession: m.FakeSession,
  MediaAccessError: m.MediaAccessError,
}))

import { SfuDirectCall } from '../sfu-call'
import { RECONNECT_BLIP_MS, RING_TIMEOUT_MS } from '../call-config'
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
  m.subs.clear()
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
    expect(sent('/app/call.start')).toEqual([{ conversationId: 'conv', media: 'audio', merge: true }])

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

  it('shows reconnecting, and a real drop keeps the call open to rejoin', async () => {
    await connect()
    const session = m.FakeSession.last!
    session.onReconnecting!(true)
    expect(store().reconnecting).toBe(true)
    session.onReconnecting!(false)
    expect(store().reconnecting).toBe(false)
    session.onDisconnected!('failed')
    expect(sent('/app/call.leave')).toEqual([]) // a minute to rejoin first
    expect(store().reconnectWait).toBe('self')
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

describe('final-review fixes', () => {
  const connect = async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    started()
    await flush()
    m.FakeSession.last!.join('bob')
  }
  const topicEvent = (event: object) =>
    m.subs.get('/topic/conversation/conv')!({ body: JSON.stringify(event) })

  it('a room the server closed ends the call as the other side hanging up — no leave, no log', async () => {
    await connect()
    m.sendMessage.mockClear()
    m.FakeSession.last!.onDisconnected!('ended' as never)
    expect(hooks.onEndNotice).toHaveBeenCalledWith('hangup', true, 'Bob')
    expect(sent('/app/call.leave')).toEqual([])
    expect(m.sendMessage).not.toHaveBeenCalled()
  })

  it('hears call.ended for its own conversation even with that thread closed', async () => {
    await connect()
    topicEvent({ event: 'call.ended', callId: 'c1', reason: 'hangup' })
    expect(hooks.onEndNotice).toHaveBeenCalledWith('hangup', true, 'Bob')
    expect(store().status).toBe('idle')
  })

  it('waits a minute for the other person to come back, then ends', async () => {
    await connect()
    m.FakeSession.last!.leave('bob')
    expect(store().reconnectWait).toBe('peer')
    vi.advanceTimersByTime(59_000)
    m.FakeSession.last!.join('bob') // came back in time
    expect(store().reconnectWait).toBeNull()
    vi.advanceTimersByTime(5_000)
    expect(store().status).toBe('connected')

    m.FakeSession.last!.leave('bob')
    vi.advanceTimersByTime(60_000)
    expect(store().status).toBe('idle')
    expect(hooks.onEndNotice).toHaveBeenCalledWith('failed', false, 'Bob')
  })

  it('hands the remote stream to the UI once, not on every speaking change', async () => {
    await connect()
    m.FakeSession.last!.onPeersChanged!()
    m.FakeSession.last!.onPeersChanged!()
    expect(hooks.onRemoteStream).toHaveBeenCalledTimes(1)
  })

  it('a caller hanging up while still ringing also leaves, in case the callee just answered', async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    started()
    await flush()
    call.endCall('hangup')
    expect(sent('/app/call.cancel')).toEqual([{ callId: 'c1', reason: 'hangup' }])
    expect(sent('/app/call.leave')).toEqual([{ callId: 'c1' }])
  })

  it('a mesh call.started for our pending start ends that stray session and fails cleanly', async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    topicEvent({
      event: 'call.started', callId: 'c7', conversationId: 'conv', media: 'audio',
      aiNotetaker: false, startedBy: 'me', startedByName: 'me', participants: [],
      transport: 'mesh', kind: 'direct',
    })
    expect(sent('/app/call.leave')).toEqual([{ callId: 'c7' }])
    expect(hooks.onEndNotice).toHaveBeenCalledWith('failed', false, 'Bob')
    expect(m.FakeSession.last).toBeNull()
  })

  it('a double click on Answer while the permission prompt is open answers once', async () => {
    ring()
    const first = call.acceptIncoming()
    const second = call.acceptIncoming()
    await Promise.all([first, second])
    await flush()
    expect(sent('/app/call.accept')).toHaveLength(1)
  })

  it('a new call starts without the previous call\'s reconnecting/poor flags', async () => {
    useCallStore.setState({ reconnecting: true, poorConnection: true })
    await call.startCall('bob', 'Bob', 'conv', false)
    expect(store().reconnecting).toBe(false)
    expect(store().poorConnection).toBe(false)
  })
})


describe('both call each other at the same time', () => {
  const merged = (callId = 'c-a', media: 'audio' | 'video' = 'video') =>
    call.handleSignal({
      type: 'call-merged',
      callId,
      conversationId: 'conv',
      senderId: 'alice',
      media,
      transport: 'sfu',
      kind: 'direct',
    })

  it('does not answer "busy" to the person we are calling — the server joins the two calls', async () => {
    await call.startCall('alice', 'Alice', 'conv', false)
    ring('c-a')
    expect(sent('/app/call.decline')).toEqual([])
    expect(store().status).toBe('outgoing')
  })

  it('joins their call when the server merges ours into it, then connects', async () => {
    await call.startCall('alice', 'Alice', 'conv', false)
    merged('c-a', 'video')
    await flush()
    expect(store().callId).toBe('c-a')
    expect(store().video).toBe(true) // the call's media wins
    expect(m.getToken).toHaveBeenCalledWith('c-a')
    expect(m.FakeSession.last!.connect).toHaveBeenCalledWith('wss://rtc', 'tok', { video: true })

    // Our other devices stop ringing for their call: that echo must not end ours.
    call.handleSignal({ type: 'call-ring-cancel', callId: 'c-a', reason: 'answered_elsewhere' })
    m.FakeSession.last!.join('alice')
    expect(store().status).toBe('connected')
    vi.advanceTimersByTime(RING_TIMEOUT_MS)
    expect(sent('/app/call.cancel')).toEqual([])
  })

  it('ignores a merge for a call we are not making', async () => {
    merged()
    await flush()
    expect(store().status).toBe('idle')
    expect(m.getToken).not.toHaveBeenCalled()
  })

  it("does not take the other person's call.started for our own start", async () => {
    await call.startCall('alice', 'Alice', 'conv', false)
    call.handleCallEvent({
      event: 'call.started',
      callId: 'c-a',
      conversationId: 'conv',
      media: 'video',
      aiNotetaker: false,
      startedBy: 'alice',
      startedByName: 'alice',
      participants: [],
      transport: 'sfu',
      kind: 'direct',
    })
    await flush()
    expect(m.getToken).not.toHaveBeenCalled()

    merged('c-a')
    await flush()
    expect(m.getToken).toHaveBeenCalledTimes(1) // one room session, not two
  })

  it('a repeated merge does not join the room twice', async () => {
    await call.startCall('alice', 'Alice', 'conv', false)
    merged('c-a')
    merged('c-a')
    await flush()
    expect(m.getToken).toHaveBeenCalledTimes(1)
  })

  it('leaves their call when we hung up before the merge arrived', async () => {
    await call.startCall('alice', 'Alice', 'conv', false)
    call.endCall('hangup')
    merged()
    await flush()
    expect(sent('/app/call.leave')).toEqual([{ callId: 'c-a' }])
    expect(m.getToken).not.toHaveBeenCalled()
  })
})

describe('weak network, reconnecting and switching to video', () => {
  const connect = async (video = false) => {
    await call.startCall('bob', 'Bob', 'conv', video)
    started()
    await flush()
    m.FakeSession.last!.join('bob', { video })
  }

  it("LiveKit reconnecting shows that it is our own connection", async () => {
    await connect()
    m.FakeSession.last!.onReconnecting?.(true)
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    expect(store().reconnectWait).toBe('self')
    m.FakeSession.last!.onReconnecting?.(false)
    expect(store().reconnectWait).toBeNull()
  })

  it('a LiveKit blip that resumes in time shows no wait', async () => {
    await connect()
    m.FakeSession.last!.onReconnecting?.(true)
    vi.advanceTimersByTime(RECONNECT_BLIP_MS - 1)
    m.FakeSession.last!.onReconnecting?.(false)
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    expect(store().reconnectWait).toBeNull()
  })

  it('resumed while they are gone: the wait turns to them', async () => {
    await connect()
    const session = m.FakeSession.last!
    session.onReconnecting?.(true)
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    session.peersById.delete('bob') // they left while we were away
    session.onReconnecting?.(false)
    expect(store().reconnectWait).toBe('peer')
    session.join('bob')
    expect(store().reconnectWait).toBeNull()
  })

  it('a resume before anyone answered leaves no wait behind', async () => {
    await call.startCall('bob', 'Bob', 'conv', false)
    started()
    await flush()
    m.FakeSession.last!.onReconnecting?.(true)
    m.FakeSession.last!.onReconnecting?.(false)
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    expect(store().reconnectWait).toBeNull()
  })

  it('a lost room is rejoined within the minute', async () => {
    await connect()
    const first = m.FakeSession.last!
    first.onDisconnected?.('failed')
    expect(store().reconnectWait).toBe('self')
    await flush()
    expect(store().status).toBe('connected')
    expect(store().reconnectWait).toBe('peer') // we are back; they are not in the room yet
    expect(m.getToken).toHaveBeenCalledTimes(2)
    const second = m.FakeSession.last!
    expect(second).not.toBe(first)
    second.join('bob')
    expect(store().reconnectWait).toBeNull()
    expect(sent('/app/call.leave')).toEqual([])
  })

  it('a rejoin keeps the mic muted and ends the wait once they are back', async () => {
    await connect()
    call.toggleMic(false)
    const first = m.FakeSession.last!
    first.onReconnecting?.(true) // LiveKit tried to resume, then gave up
    first.onDisconnected?.('failed')
    await flush()
    const second = m.FakeSession.last!
    expect(second).not.toBe(first)
    expect(second.setMic).toHaveBeenCalledWith(false)
    second.join('bob')
    expect(store().reconnectWait).toBeNull()
    await vi.advanceTimersByTimeAsync(8_000)
    expect(m.FakeSession.last).toBe(second) // no further rejoin tears it down
  })

  it('gives up after a minute when the room cannot be rejoined', async () => {
    await connect()
    m.getToken.mockRejectedValue(new Error('offline'))
    m.FakeSession.last!.onDisconnected?.('failed')
    await vi.advanceTimersByTimeAsync(59_000)
    expect(store().status).toBe('connected')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(store().status).toBe('idle')
    expect(hooks.onEndNotice).toHaveBeenCalledWith('failed', false, 'Bob')
    m.getToken.mockResolvedValue({ url: 'wss://rtc', token: 'tok' })
  })

  it("shows the other person's weak network", async () => {
    await connect()
    m.FakeSession.last!.join('bob', { poor: true })
    expect(store().peerPoor).toBe(true)
    m.FakeSession.last!.join('bob', { poor: false })
    expect(store().peerPoor).toBe(false)
  })

  it('turning the camera on in a voice call publishes it and makes it a video call', async () => {
    await connect()
    call.toggleCamera(true)
    expect(m.FakeSession.last!.setCamera).toHaveBeenCalledWith(true)
    expect(store().cameraEnabled).toBe(true)
    expect(store().video).toBe(true)
  })

  it("follows the other person's camera", async () => {
    await connect()
    expect(store().peerCamera).toBe(false)
    m.FakeSession.last!.join('bob', { video: true })
    expect(store().peerCamera).toBe(true)
    m.FakeSession.last!.join('bob', { video: true, camMuted: true })
    expect(store().peerCamera).toBe(false)
  })
})
