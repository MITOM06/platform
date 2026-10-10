import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { publish, sendMessage, stompUp } = vi.hoisted(() => ({
  publish: vi.fn(),
  sendMessage: vi.fn(() => Promise.resolve()),
  stompUp: { value: true },
}))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish, isConnected: () => stompUp.value } }))
vi.mock('@/lib/api/chat', () => ({ chatService: { sendMessage } }))

import { callManager, DISCONNECT_GRACE_MS, RING_TIMEOUT_MS } from '../call-manager'
import { useCallStore } from '@/lib/store/call.store'
import { CAMERA_OFFER_WAIT_MS, RECONNECT_BLIP_MS } from '../call-config'

interface FakeTransceiver {
  receiver: { track: { kind: string } }
  sender: { track: unknown; replaceTrack: ReturnType<typeof vi.fn>; setStreams: ReturnType<typeof vi.fn> }
  direction: string
}

class FakePeerConnection {
  static last: FakePeerConnection | null = null
  connectionState = 'new'
  signalingState = 'stable'
  transceivers: FakeTransceiver[] = []
  onicecandidate: unknown = null
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  addTrack = vi.fn()
  close = vi.fn()
  createOffer = vi.fn<(opts?: { iceRestart?: boolean }) => Promise<{ type: string; sdp: string }>>(
    async () => ({ type: 'offer', sdp: 'v=0' }),
  )
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'v=0' }))
  setLocalDescription = vi.fn(async (d: { type: string }) => {
    this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable'
  })
  setRemoteDescription = vi.fn(async (d: { type: string }) => {
    this.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable'
  })
  getStats = vi.fn(async () => new Map())
  getTransceivers = () => this.transceivers
  addTransceiver = vi.fn((kind: string, init: { direction: string }) => {
    const t = this.videoLine(kind)
    t.direction = init.direction
    return t
  })
  /** A transceiver the remote offer (or addTransceiver) created. */
  videoLine(kind = 'video'): FakeTransceiver {
    const t: FakeTransceiver = {
      receiver: { track: { kind } },
      sender: { track: null, replaceTrack: vi.fn(async () => {}), setStreams: vi.fn() },
      direction: 'recvonly',
    }
    this.transceivers.push(t)
    return t
  }
  addIceCandidate = vi.fn<(c: RTCIceCandidateInit) => Promise<void>>(async () => {})
  constructor() {
    FakePeerConnection.last = this
  }
  /** Simulate an ICE/DTLS state change. */
  goTo(state: string) {
    this.connectionState = state
    this.onconnectionstatechange?.()
  }
}

const fakeStream = { getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] }
const getUserMedia = vi.fn()
const onEndNotice = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  getUserMedia.mockReset().mockResolvedValue(fakeStream)
  FakePeerConnection.last = null
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })
  callManager.onEndNotice = onEndNotice
  callManager.endCall() // reset any call left over from the previous test
  useCallStore.getState().reset()
  publish.mockClear()
  sendMessage.mockClear()
  onEndNotice.mockClear()
})

afterEach(() => {
  stompUp.value = true
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  callManager.onEndNotice = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const endSignals = () => publish.mock.calls.filter(([dest]) => dest === '/app/call.end')
const offerFrom = (senderId: string, sdp = 'v=0\r\nm=audio 9') =>
  callManager.handleSignal({ type: 'offer', senderId, conversationId: 'conv-1', sdp })
const ice = (senderId: string, candidate: string) =>
  callManager.handleSignal({ type: 'ice', senderId, candidate: { candidate } })

describe('outgoing ring', () => {
  it('gives up after the ring timeout with reason no_answer', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    vi.advanceTimersByTime(RING_TIMEOUT_MS - 1)
    expect(useCallStore.getState().status).toBe('outgoing')

    vi.advanceTimersByTime(1)
    expect(useCallStore.getState().status).toBe('idle')
    expect(endSignals()).toHaveLength(1)
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'bob', type: 'end', reason: 'no_answer' })
    expect(sendMessage).toHaveBeenCalledWith('conv-1', 'system.call.missed:voice', 'system')
    expect(onEndNotice).toHaveBeenCalledWith('no_answer', false, 'Bob')
  })

  it('tells the caller the callee declined', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'end', senderId: 'bob', reason: 'declined' })
    expect(useCallStore.getState().status).toBe('idle')
    expect(onEndNotice).toHaveBeenCalledWith('declined', true, 'Bob')
    vi.advanceTimersByTime(RING_TIMEOUT_MS)
    expect(endSignals()).toHaveLength(1) // only the echo below — no ring-timeout end
  })

  it('after a decline, tells every session of the callee to stop ringing', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'end', senderId: 'bob', reason: 'declined' })
    expect(endSignals()).toHaveLength(1)
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'bob', conversationId: 'conv-1', reason: 'hangup' })
  })

  it('does not echo an end when the peer simply hung up', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'end', senderId: 'bob', reason: 'hangup' })
    expect(endSignals()).toHaveLength(0)
  })

  it('treats an end without reason (older client) as hangup', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'end', senderId: 'bob' })
    expect(onEndNotice).toHaveBeenCalledWith('hangup', true, 'Bob')
  })

  it('logs a missed call and explains a busy callee', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', true)
    callManager.handleSignal({ type: 'end', senderId: 'bob', reason: 'busy' })
    expect(sendMessage).toHaveBeenCalledWith('conv-1', 'system.call.missed:video', 'system')
    expect(onEndNotice).toHaveBeenCalledWith('busy', true, 'Bob')
  })

  it('ignores an end from someone who is not the current peer', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'end', senderId: 'carol', reason: 'hangup' })
    expect(useCallStore.getState().status).toBe('outgoing')
    expect(onEndNotice).not.toHaveBeenCalled()
  })

  it('does not leave the caller on "Calling…" when the mic/camera cannot be opened', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'))
    await expect(callManager.startCall('bob', 'Bob', 'conv-1', true)).rejects.toThrow()
    expect(useCallStore.getState().status).toBe('idle')
    expect(publish).not.toHaveBeenCalled()
  })
})

describe('incoming call', () => {
  it('rings on an offer while idle', () => {
    offerFrom('alice', 'v=0\r\nm=audio 9\r\nm=video 9')
    const st = useCallStore.getState()
    expect(st.status).toBe('incoming')
    expect(st.peerId).toBe('alice')
    expect(st.video).toBe(true)
  })

  it('applies candidates that arrived while ringing once the call is answered', async () => {
    offerFrom('alice')
    ice('alice', 'cand-1')
    ice('alice', 'cand-2')
    ice('mallory', 'cand-x') // not the caller — must be dropped
    await callManager.acceptIncoming()
    const added = FakePeerConnection.last!.addIceCandidate.mock.calls.map(([c]) => c.candidate)
    expect(added).toEqual(['cand-1', 'cand-2'])
  })

  it('replies busy to a second caller and keeps the current call', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'offer', senderId: 'carol', conversationId: 'conv-2', sdp: 'v=0' })
    expect(endSignals()).toHaveLength(1)
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'carol', conversationId: 'conv-2', reason: 'busy' })
    expect(useCallStore.getState().peerId).toBe('bob')
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('ignores a repeated offer from the caller already ringing', () => {
    offerFrom('alice')
    offerFrom('alice')
    expect(endSignals()).toHaveLength(0)
    expect(useCallStore.getState().status).toBe('incoming')
  })

  it('declining tells the caller why', () => {
    offerFrom('alice')
    callManager.endCall('declined')
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'alice', reason: 'declined' })
    expect(useCallStore.getState().status).toBe('idle')
    expect(onEndNotice).toHaveBeenCalledWith('declined', false, '')
  })

  it('a caller cancelling before answer clears the prompt without a toast', () => {
    offerFrom('alice')
    callManager.handleSignal({ type: 'end', senderId: 'alice', reason: 'no_answer' })
    expect(useCallStore.getState().status).toBe('idle')
    expect(onEndNotice).not.toHaveBeenCalled()
  })

  it('answering without mic/camera permission tells the caller and resets', async () => {
    offerFrom('alice')
    getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'))
    await callManager.acceptIncoming()
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'alice', reason: 'media_error' })
    expect(useCallStore.getState().status).toBe('idle')
    expect(onEndNotice).toHaveBeenCalledWith('media_error', false, '')
  })

  it('a double click on Answer sets up only one connection', async () => {
    offerFrom('alice')
    await Promise.all([callManager.acceptIncoming(), callManager.acceptIncoming()])
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })
})

/** A call where media flows: we are the caller (default) or the callee. */
async function connectedCall(asCaller = true, video = false) {
  if (asCaller) {
    await callManager.startCall('bob', 'Bob', 'conv-1', video)
  } else {
    offerFrom('bob', video ? 'v=0\r\nm=audio 9\r\nm=video 9' : 'v=0\r\nm=audio 9')
    await callManager.acceptIncoming()
  }
  const pc = FakePeerConnection.last!
  pc.ontrack?.({ streams: [fakeStream as unknown as MediaStream] })
  pc.goTo('connected')
  publish.mockClear()
  return pc
}
const statesSent = () => publish.mock.calls.filter(([d]) => d === '/app/call.state').map(([, b]) => b)
const offersSent = () => publish.mock.calls.filter(([d]) => d === '/app/call.offer')
const answersSent = () => publish.mock.calls.filter(([d]) => d === '/app/call.answer')
const state = (extra: Record<string, unknown>) =>
  callManager.handleSignal({ type: 'state', senderId: 'bob', conversationId: 'conv-1', ...extra } as never)

describe('connection lost: a minute to reconnect', () => {
  it('a blip that recovers by itself shows no wait and restarts nothing', async () => {
    const pc = await connectedCall(true)
    pc.goTo('disconnected')
    vi.advanceTimersByTime(RECONNECT_BLIP_MS - 1)
    pc.goTo('connected')
    await vi.advanceTimersByTimeAsync(DISCONNECT_GRACE_MS)
    expect(useCallStore.getState().reconnectWait).toBeNull()
    expect(offersSent()).toHaveLength(0)
    expect(endSignals()).toHaveLength(0)
  })

  it('waits a minute for the other person, then ends as failed', async () => {
    const pc = await connectedCall()
    pc.goTo('disconnected')
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    expect(useCallStore.getState().reconnectWait).toBe('peer')
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS - 1)
    expect(endSignals()).toHaveLength(0)
    expect(useCallStore.getState().status).toBe('connected')
    vi.advanceTimersByTime(1)
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'bob', reason: 'failed' })
    expect(onEndNotice).toHaveBeenCalledWith('failed', false, 'Bob')
  })

  it('goes on when the connection comes back in time', async () => {
    const pc = await connectedCall()
    pc.goTo('failed') // not ended at once any more
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    vi.advanceTimersByTime(30_000)
    pc.goTo('connected')
    expect(useCallStore.getState().reconnectWait).toBeNull()
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS)
    expect(endSignals()).toHaveLength(0)
    expect(useCallStore.getState().status).toBe('connected')
  })

  it('says it is our own connection when we are offline', async () => {
    const pc = await connectedCall()
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    pc.goTo('disconnected')
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    expect(useCallStore.getState().reconnectWait).toBe('self')
  })

  it('the caller restarts ICE right away and keeps retrying', async () => {
    const pc = await connectedCall(true)
    pc.goTo('disconnected')
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    await vi.advanceTimersByTimeAsync(0)
    expect(pc.createOffer).toHaveBeenLastCalledWith({ iceRestart: true })
    expect(offersSent()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(4_000)
    expect(offersSent()).toHaveLength(2)
  })

  it('does not stack restart offers: the callee asking while we already restart adds none', async () => {
    const pc = await connectedCall(true)
    pc.goTo('disconnected')
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    await vi.advanceTimersByTimeAsync(0)
    state({ restart: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(offersSent()).toHaveLength(1)
  })

  it("a callee's reconnect request gets an ICE restart even before we notice the drop", async () => {
    const pc = await connectedCall(true)
    state({ restart: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(pc.createOffer).toHaveBeenLastCalledWith({ iceRestart: true })
  })

  it('a call whose connection never came up fails at once, without the reconnect wait', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    const pc = FakePeerConnection.last!
    pc.ontrack?.({ streams: [fakeStream as unknown as MediaStream] }) // SDP in, ICE never connected
    pc.goTo('failed')
    expect(useCallStore.getState().reconnectWait).toBeNull()
    expect(endSignals()[0][1]).toMatchObject({ reason: 'failed' })
  })

  it('the callee asks the caller to restart', async () => {
    const pc = await connectedCall(false)
    pc.goTo('disconnected')
    vi.advanceTimersByTime(RECONNECT_BLIP_MS)
    expect(statesSent()).toContainEqual(expect.objectContaining({ targetId: 'bob', restart: true }))
    expect(offersSent()).toHaveLength(0)
  })

  it("the callee answers the caller's mid-call offer instead of taking it for a new call", async () => {
    const pc = await connectedCall(false)
    callManager.handleSignal({ type: 'offer', senderId: 'bob', targetId: 'alice', conversationId: 'conv-1', sdp: 'v=1' })
    await vi.advanceTimersByTimeAsync(0)
    expect(pc.setRemoteDescription).toHaveBeenLastCalledWith({ type: 'offer', sdp: 'v=1' })
    expect(answersSent()).toHaveLength(1)
    expect(endSignals()).toHaveLength(0)
  })

  it("the caller restarts when the callee asks", async () => {
    await connectedCall(true)
    state({ restart: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(offersSent()).toHaveLength(1)
  })
})

describe('switching between voice and video', () => {
  const cameraStream = () => {
    const video = { kind: 'video', enabled: true, stop: vi.fn() }
    getUserMedia.mockResolvedValueOnce({ getVideoTracks: () => [video], getTracks: () => [video] })
    return video
  }

  it('the caller turns the camera on: adds it and renegotiates', async () => {
    const pc = await connectedCall(true)
    const video = cameraStream()
    callManager.toggleCamera(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: true })
    expect(pc.addTrack).toHaveBeenLastCalledWith(video, expect.anything())
    expect(offersSent()).toHaveLength(1)
    expect(statesSent()).toContainEqual(expect.objectContaining({ video: true }))
    expect(useCallStore.getState().cameraEnabled).toBe(true)
    expect(useCallStore.getState().video).toBe(true) // logged as a video call
  })

  it('the callee turns the camera on: asks for a video line and sends on it', async () => {
    const pc = await connectedCall(false)
    const video = cameraStream()
    callManager.toggleCamera(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(statesSent()).toContainEqual(expect.objectContaining({ video: true, restart: true }))

    pc.videoLine() // the caller's offer brings a video m-line
    callManager.handleSignal({ type: 'offer', senderId: 'bob', targetId: 'alice', conversationId: 'conv-1', sdp: 'v=2' })
    await vi.advanceTimersByTimeAsync(0)
    // addTrack reuses that line and carries our stream, on every browser.
    expect(pc.addTrack).toHaveBeenLastCalledWith(video, expect.anything())
    expect(answersSent()).toHaveLength(1)
  })

  it("the callee's camera is turned back off, with a notice, when the caller never renegotiates (an older app)", async () => {
    await connectedCall(false)
    const video = cameraStream()
    callManager.toggleCamera(true)
    await vi.advanceTimersByTimeAsync(0)
    publish.mockClear()
    await vi.advanceTimersByTimeAsync(CAMERA_OFFER_WAIT_MS)
    expect(video.stop).toHaveBeenCalled()
    expect(useCallStore.getState().cameraEnabled).toBe(false)
    expect(useCallStore.getState().video).toBe(false) // still logged as a voice call
    expect(useCallStore.getState().videoUnavailable).toBe(true)
    expect(statesSent()).toContainEqual(expect.objectContaining({ video: false }))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(useCallStore.getState().videoUnavailable).toBe(false) // the notice goes away
  })

  it("keeps the callee's camera once the caller's offer took it", async () => {
    const pc = await connectedCall(false)
    const video = cameraStream()
    callManager.toggleCamera(true)
    await vi.advanceTimersByTimeAsync(0)
    pc.videoLine()
    callManager.handleSignal({ type: 'offer', senderId: 'bob', targetId: 'alice', conversationId: 'conv-1', sdp: 'v=2' })
    await vi.advanceTimersByTimeAsync(CAMERA_OFFER_WAIT_MS)
    expect(video.stop).not.toHaveBeenCalled()
    expect(useCallStore.getState().cameraEnabled).toBe(true)
    expect(useCallStore.getState().videoUnavailable).toBe(false)
  })

  it('the caller adds a video line when the callee wants to send video', async () => {
    const pc = await connectedCall(true)
    state({ video: true, restart: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(pc.addTransceiver).toHaveBeenCalledWith('video', { direction: 'recvonly' })
    expect(offersSent()).toHaveLength(1)
    expect(useCallStore.getState().peerCamera).toBe(true)
  })

  it('turning the camera off tells the other side', async () => {
    await connectedCall(true, true)
    callManager.toggleCamera(false)
    expect(statesSent()).toContainEqual(expect.objectContaining({ video: false }))
    expect(useCallStore.getState().cameraEnabled).toBe(false)
  })

  it("follows the other person's camera", async () => {
    await connectedCall(true)
    state({ video: true })
    expect(useCallStore.getState().peerCamera).toBe(true)
    state({ video: false })
    expect(useCallStore.getState().peerCamera).toBe(false)
  })

  it('ignores call state from someone who is not in the call', async () => {
    await connectedCall(true)
    callManager.handleSignal({ type: 'state', senderId: 'carol', conversationId: 'conv-1', video: true } as never)
    expect(useCallStore.getState().peerCamera).toBe(false)
  })
})

describe('whose network is weak (peer-to-peer)', () => {
  it('the other side receiving us badly means our network is weak', async () => {
    await connectedCall(true)
    state({ quality: 'poor' })
    expect(useCallStore.getState().poorConnection).toBe(true)
    expect(useCallStore.getState().peerPoor).toBe(false)
    state({ quality: 'good' })
    expect(useCallStore.getState().poorConnection).toBe(false)
  })
})

describe('call ended while the mic/camera is still opening', () => {
  const pendingMedia = () => {
    const track = { stop: vi.fn(), enabled: true }
    const stream = { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] }
    let resolve!: (s: typeof stream) => void
    getUserMedia.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    return { track, stream, resolve: () => resolve(stream) }
  }

  it('callee: the caller giving up during the permission prompt ends silently', async () => {
    const media = pendingMedia()
    offerFrom('alice')
    const accepting = callManager.acceptIncoming()
    callManager.handleSignal({ type: 'end', senderId: 'alice', reason: 'no_answer' })
    media.resolve()
    await accepting
    expect(endSignals()).toHaveLength(0)
    expect(onEndNotice).not.toHaveBeenCalled()
    expect(useCallStore.getState().status).toBe('idle')
    expect(media.track.stop).toHaveBeenCalled() // late stream released
  })

  it('caller: hanging up during the permission prompt places no call and logs nothing', async () => {
    const media = pendingMedia()
    const starting = callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.endCall()
    media.resolve()
    await expect(starting).resolves.toBeUndefined()
    expect(publish).not.toHaveBeenCalled()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(media.track.stop).toHaveBeenCalled()
    vi.advanceTimersByTime(RING_TIMEOUT_MS)
    expect(publish).not.toHaveBeenCalled()
  })
})

describe('both call each other at the same time (peer-to-peer)', () => {
  // Bob's offer crosses ours. `targetId` is us, as the caller addressed it.
  const crossedOffer = (me: string, sdp = 'v=0\r\nm=audio 9') =>
    callManager.handleSignal({ type: 'offer', senderId: 'bob', targetId: me, conversationId: 'conv-1', sdp })
  const answers = () => publish.mock.calls.filter(([dest]) => dest === '/app/call.answer')

  it('the side with the smaller user id answers the other offer instead of ringing', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    const ownPc = FakePeerConnection.last!
    crossedOffer('alice', 'v=0\r\nm=audio 9\r\nm=video 9')
    ice('bob', 'cand-1')
    await vi.advanceTimersByTimeAsync(0)

    expect(ownPc.close).toHaveBeenCalled() // our own offer is dropped silently
    expect(endSignals()).toHaveLength(0)
    expect(answers()).toHaveLength(1)
    expect(answers()[0][1]).toMatchObject({ targetId: 'bob', conversationId: 'conv-1', type: 'answer' })
    const pc = FakePeerConnection.last!
    expect(pc).not.toBe(ownPc)
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'v=0\r\nm=audio 9\r\nm=video 9' })
    expect(pc.addIceCandidate.mock.calls.map(([c]) => c.candidate)).toEqual(['cand-1'])
    expect(useCallStore.getState().status).toBe('outgoing') // still "Calling…" until media flows
    expect(useCallStore.getState().video).toBe(true) // their offer's media wins
    expect(useCallStore.getState().peerName).toBe('Bob')
  })

  it('the side with the larger user id keeps its own offer and waits for the answer', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    const ownPc = FakePeerConnection.last!
    crossedOffer('zoe') // 'zoe' > 'bob': Bob answers our offer
    await vi.advanceTimersByTimeAsync(0)

    expect(ownPc.close).not.toHaveBeenCalled()
    expect(answers()).toHaveLength(0)
    expect(endSignals()).toHaveLength(0) // not "busy"
    expect(useCallStore.getState().status).toBe('outgoing')
  })

  it('keeps the mic muted when it was muted while calling', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.toggleMic(false)
    const track = { enabled: true, stop: vi.fn() }
    getUserMedia.mockResolvedValueOnce({ getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] })
    crossedOffer('alice')
    await vi.advanceTimersByTimeAsync(0)
    expect(track.enabled).toBe(false)
    expect(useCallStore.getState().micEnabled).toBe(false)
  })

  it('the answering side is not left ringing out', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    crossedOffer('alice')
    await vi.advanceTimersByTimeAsync(0)
    vi.advanceTimersByTime(RING_TIMEOUT_MS)
    expect(endSignals()).toHaveLength(0) // the old ring timer died with our offer
  })
})

describe('tapping Call on someone who is ringing us', () => {
  it('answers their call instead of placing a second one', async () => {
    offerFrom('alice')
    await callManager.startCall('alice', 'Alice', 'conv-1', false)
    await vi.advanceTimersByTimeAsync(0)
    expect(publish.mock.calls.filter(([d]) => d === '/app/call.offer')).toHaveLength(0)
    expect(publish.mock.calls.filter(([d]) => d === '/app/call.answer')).toHaveLength(1)
  })

  it('does nothing while another call is going on', async () => {
    offerFrom('alice')
    await callManager.startCall('carol', 'Carol', 'conv-2', false)
    expect(publish).not.toHaveBeenCalled()
    expect(useCallStore.getState().peerId).toBe('alice')
  })
})

describe('answered on another device', () => {
  const answeredElsewhere = (senderId = 'bob', conversationId = 'conv-1') =>
    callManager.handleSignal({ type: 'answered-elsewhere', senderId, conversationId } as never)

  it('stops ringing here, quietly: no end to the caller, no missed-call log', () => {
    offerFrom('bob')
    expect(useCallStore.getState().status).toBe('incoming')
    answeredElsewhere()
    expect(useCallStore.getState().status).toBe('idle')
    expect(endSignals()).toHaveLength(0)
    expect(sendMessage).not.toHaveBeenCalled()
    expect(onEndNotice).not.toHaveBeenCalled()
  })

  it('leaves a ring from someone else, or another conversation, alone', () => {
    offerFrom('bob')
    answeredElsewhere('carol')
    answeredElsewhere('bob', 'conv-2')
    expect(useCallStore.getState().status).toBe('incoming')
  })

  it('is ignored by the device that answered', async () => {
    offerFrom('bob')
    await callManager.acceptIncoming()
    answeredElsewhere()
    expect(useCallStore.getState().status).not.toBe('idle')
    expect(FakePeerConnection.last!.close).not.toHaveBeenCalled()
  })
})
