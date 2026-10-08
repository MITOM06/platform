import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { publish, sendMessage } = vi.hoisted(() => ({
  publish: vi.fn(),
  sendMessage: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish } }))
vi.mock('@/lib/api/chat', () => ({ chatService: { sendMessage } }))

import { callManager, DISCONNECT_GRACE_MS, RING_TIMEOUT_MS } from '../call-manager'
import { useCallStore } from '@/lib/store/call.store'

class FakePeerConnection {
  static last: FakePeerConnection | null = null
  connectionState = 'new'
  onicecandidate: unknown = null
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  addTrack = vi.fn()
  close = vi.fn()
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0' }))
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'v=0' }))
  setLocalDescription = vi.fn(async () => {})
  setRemoteDescription = vi.fn(async () => {})
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

describe('connection health', () => {
  it('ends with reason failed when the connection fails', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    FakePeerConnection.last!.goTo('failed')
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'bob', reason: 'failed' })
    expect(onEndNotice).toHaveBeenCalledWith('failed', false, 'Bob')
  })

  it('survives a short disconnect and ends a long one', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    const pc = FakePeerConnection.last!
    pc.goTo('disconnected')
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS - 1)
    pc.goTo('connected')
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS)
    expect(endSignals()).toHaveLength(0)

    pc.goTo('disconnected')
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS)
    expect(endSignals()[0][1]).toMatchObject({ reason: 'failed' })
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
