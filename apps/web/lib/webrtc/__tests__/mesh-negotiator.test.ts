import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

const { publish } = vi.hoisted(() => ({ publish: vi.fn() }))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish } }))

import { MeshNegotiator, type NegotiationLink } from '../mesh-negotiator'

function fakePc(transceivers: { receiver: { track: { kind: string } | null } }[] = []) {
  return {
    getTransceivers: vi.fn(() => transceivers),
    addTransceiver: vi.fn(),
    addTrack: vi.fn(),
    createOffer: vi.fn(async (_o?: { iceRestart?: boolean }) => ({ type: 'offer', sdp: 'OFFER' })),
    createAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'ANSWER' })),
    setLocalDescription: vi.fn(async () => {}),
    setRemoteDescription: vi.fn(async () => {}),
  }
}
type Pc = ReturnType<typeof fakePc>

let pc: Pc | null
let target: { peerId: string; conversationId: string } | null
let flush: Mock<(p: unknown) => Promise<void>>
const link: NegotiationLink = {
  pc: () => pc as unknown as RTCPeerConnection,
  target: () => target,
  flush: (p) => flush(p),
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  publish.mockReset()
  pc = fakePc()
  target = { peerId: 'bob', conversationId: 'c1' }
  flush = vi.fn(async () => {})
})
afterEach(() => vi.useRealTimers())

const offers = () => publish.mock.calls.filter((c) => c[0] === '/app/call.offer')

describe('offer', () => {
  it('no pc or target → nothing', async () => {
    const n = new MeshNegotiator(link)
    target = null
    await n.offer()
    pc = null
    target = { peerId: 'bob', conversationId: 'c1' }
    await n.offer()
    expect(publish).not.toHaveBeenCalled()
  })

  it('sends an offer to the peer', async () => {
    await new MeshNegotiator(link).offer({ iceRestart: true })
    expect(pc!.createOffer).toHaveBeenCalledWith({ iceRestart: true })
    expect(offers()[0][1]).toEqual({ targetId: 'bob', conversationId: 'c1', type: 'offer', sdp: 'OFFER' })
  })

  it('adds a recvonly video line only when missing', async () => {
    await new MeshNegotiator(link).offer({ videoLine: true })
    expect(pc!.addTransceiver).toHaveBeenCalledWith('video', { direction: 'recvonly' })
    pc = fakePc([{ receiver: { track: { kind: 'video' } } }])
    await new MeshNegotiator(link).offer({ videoLine: true })
    expect(pc!.addTransceiver).not.toHaveBeenCalled()
  })

  it('queues requests while an offer is pending and merges them; answered() runs the queue', async () => {
    const n = new MeshNegotiator(link)
    await n.offer()
    await n.offer({ videoLine: true })
    await n.offer({ iceRestart: true })
    expect(offers()).toHaveLength(1)
    n.answered()
    await vi.runAllTimersAsync()
    expect(offers()).toHaveLength(2)
    expect(pc!.createOffer).toHaveBeenLastCalledWith({ iceRestart: true })
    expect(pc!.addTransceiver).toHaveBeenCalled()
    n.answered()
    expect(offers()).toHaveLength(2)
  })

  it('a stale pending offer no longer blocks (10 s, or 3.5 s for an ICE restart)', async () => {
    const n = new MeshNegotiator(link)
    await n.offer()
    vi.setSystemTime(3_600)
    await n.offer({ iceRestart: true })
    expect(offers()).toHaveLength(2)
    vi.setSystemTime(5_000)
    await n.offer()
    expect(offers()).toHaveLength(2)
    vi.setSystemTime(14_000)
    await n.offer()
    expect(offers()).toHaveLength(3)
  })

  it('drops the offer if the pc was replaced mid-way', async () => {
    const original = pc!
    original.createOffer.mockImplementationOnce(async () => { pc = fakePc(); return { type: 'offer', sdp: 'X' } })
    await new MeshNegotiator(link).offer()
    expect(original.setLocalDescription).not.toHaveBeenCalled()
    pc = original
    original.setLocalDescription.mockImplementationOnce(async () => { pc = fakePc() })
    await new MeshNegotiator(link).offer()
    expect(publish).not.toHaveBeenCalled()
  })

  it('a failed createOffer clears pending so the next offer goes out', async () => {
    const n = new MeshNegotiator(link)
    pc!.createOffer.mockRejectedValueOnce(new Error('x'))
    await n.offer()
    await n.offer()
    expect(offers()).toHaveLength(1)
  })
})

describe('answer', () => {
  it('no pc → true (nothing to end)', async () => {
    pc = null
    await expect(new MeshNegotiator(link).answer('S')).resolves.toBe(true)
  })

  it('answers the offer after flushing queued ICE', async () => {
    await expect(new MeshNegotiator(link).answer('S')).resolves.toBe(true)
    expect(pc!.setRemoteDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'S' })
    expect(flush).toHaveBeenCalledWith(pc)
    expect(publish).toHaveBeenCalledWith('/app/call.answer', { targetId: 'bob', conversationId: 'c1', type: 'answer', sdp: 'ANSWER' })
  })

  it('an unusable offer → false; a teardown meanwhile → true', async () => {
    pc!.setRemoteDescription.mockRejectedValueOnce(new Error('bad sdp'))
    await expect(new MeshNegotiator(link).answer('S')).resolves.toBe(false)
    pc!.setRemoteDescription.mockImplementationOnce(async () => { pc = null; throw new Error('closed') })
    await expect(new MeshNegotiator(link).answer('S')).resolves.toBe(true)
  })

  it.each(['flush', 'createAnswer', 'setLocalDescription'] as const)('stops quietly if the pc changes after %s', async (step) => {
    const swap = async () => { pc = fakePc() }
    if (step === 'flush') flush.mockImplementationOnce(swap)
    else if (step === 'createAnswer') pc!.createAnswer.mockImplementationOnce(async () => { pc = fakePc(); return { type: 'answer', sdp: 'A' } })
    else pc!.setLocalDescription.mockImplementationOnce(swap)
    await expect(new MeshNegotiator(link).answer('S')).resolves.toBe(true)
    expect(publish).not.toHaveBeenCalled()
  })

  it('a held camera is attached only once the offer has a video line', async () => {
    const n = new MeshNegotiator(link)
    const track = {} as MediaStreamTrack
    const stream = {} as MediaStream
    n.holdCamera(track, stream)
    await n.answer('audio only')
    expect(pc!.addTrack).not.toHaveBeenCalled()
    pc = fakePc([{ receiver: { track: { kind: 'video' } } }])
    await n.answer('with video')
    expect(pc!.addTrack).toHaveBeenCalledWith(track, stream)
    expect(n.releaseHeldCamera(track)).toBe(false)
  })

  it('releaseHeldCamera / reset', () => {
    const n = new MeshNegotiator(link)
    const t = {} as MediaStreamTrack
    expect(n.releaseHeldCamera(t)).toBe(false)
    n.holdCamera(t, {} as MediaStream)
    expect(n.releaseHeldCamera({} as MediaStreamTrack)).toBe(false)
    expect(n.releaseHeldCamera(t)).toBe(true)
    n.holdCamera(t, {} as MediaStream)
    n.reset()
    expect(n.releaseHeldCamera(t)).toBe(false)
  })
})
