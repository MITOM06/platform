import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  publish: vi.fn(),
  qualityCb: null as null | ((q: 'good' | 'poor') => void),
  qStart: vi.fn(),
  qStop: vi.fn(),
}))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish: h.publish, isConnected: () => true } }))
vi.mock('../quality-monitor', () => ({
  QualityMonitor: class {
    constructor(cb: (q: 'good' | 'poor') => void) { h.qualityCb = cb }
    start = h.qStart
    stop = h.qStop
  },
}))

import { MeshInCall, type InCallLink } from '../mesh-in-call'
import type { MeshNegotiator } from '../mesh-negotiator'
import { useCallStore } from '@/lib/store/call.store'
import { CAMERA_OFFER_WAIT_MS, VIDEO_UNAVAILABLE_NOTICE_MS } from '../call-config'

const initial = useCallStore.getState()
const vtrack = () => ({ kind: 'video', enabled: true, stop: vi.fn() }) as unknown as MediaStreamTrack & { stop: ReturnType<typeof vi.fn> }

let pc: { addTrack: ReturnType<typeof vi.fn> } | null
let stream: { getVideoTracks: () => MediaStreamTrack[]; addTrack: ReturnType<typeof vi.fn>; removeTrack: ReturnType<typeof vi.fn>; tracks: MediaStreamTrack[] } | null
let caller: boolean
let target: { peerId: string; conversationId: string } | null
const gum = vi.fn()
const neg = { offer: vi.fn(async () => {}), holdCamera: vi.fn(), releaseHeldCamera: vi.fn(() => true) }
const link: InCallLink = {
  pc: () => pc as unknown as RTCPeerConnection,
  localStream: () => stream as unknown as MediaStream,
  isCaller: () => caller,
  target: () => target,
  onLocalStream: vi.fn(),
  endCall: vi.fn(),
}
const origMedia = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
const states = () => h.publish.mock.calls.filter((c) => c[0] === '/app/call.state').map((c) => c[1])

beforeEach(() => {
  vi.useFakeTimers()
  useCallStore.setState(initial, true)
  useCallStore.setState({ peerId: 'bob', video: false } as never)
  h.publish.mockReset(); neg.offer.mockClear(); neg.holdCamera.mockClear(); neg.releaseHeldCamera.mockReset().mockReturnValue(true)
  ;(link.onLocalStream as ReturnType<typeof vi.fn>).mockClear()
  pc = { addTrack: vi.fn() }
  const tracks: MediaStreamTrack[] = []
  stream = { tracks, getVideoTracks: () => tracks, addTrack: vi.fn(), removeTrack: vi.fn() }
  caller = true
  target = { peerId: 'bob', conversationId: 'c1' }
  gum.mockReset()
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: gum } })
})
afterEach(() => {
  vi.useRealTimers()
  if (origMedia) Object.defineProperty(navigator, 'mediaDevices', origMedia)
})

const make = () => new MeshInCall(link, neg as unknown as MeshNegotiator)

describe('toggleCamera', () => {
  it('with an existing camera just enables / disables it and tells the peer', () => {
    const t = vtrack()
    stream!.tracks.push(t)
    make().toggleCamera(false)
    expect(t.enabled).toBe(false)
    expect(useCallStore.getState().cameraEnabled).toBe(false)
    expect(states()).toEqual([{ targetId: 'bob', conversationId: 'c1', type: 'state', video: false }])
  })

  it('caller adding a first camera: adds the track and renegotiates', async () => {
    const t = vtrack()
    gum.mockResolvedValue({ getVideoTracks: () => [t] })
    make().toggleCamera(true)
    await vi.runOnlyPendingTimersAsync()
    expect(gum).toHaveBeenCalledWith({ video: true })
    expect(stream!.addTrack).toHaveBeenCalledWith(t)
    expect(pc!.addTrack).toHaveBeenCalledWith(t, stream)
    expect(neg.offer).toHaveBeenCalled()
    expect(useCallStore.getState().video).toBe(true)
    expect(states().at(-1)).toMatchObject({ video: true })
  })

  it('callee adding a camera: holds it and asks for an offer; untaken camera is reverted with a notice', async () => {
    caller = false
    const t = vtrack()
    gum.mockResolvedValue({ getVideoTracks: () => [t] })
    make().toggleCamera(true)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(neg.holdCamera).toHaveBeenCalledWith(t, stream)
    expect(states().at(-1)).toMatchObject({ video: true, restart: true })
    vi.advanceTimersByTime(CAMERA_OFFER_WAIT_MS)
    expect(stream!.removeTrack).toHaveBeenCalledWith(t)
    expect(t.stop).toHaveBeenCalled()
    expect(useCallStore.getState()).toMatchObject({ cameraEnabled: false, video: false, videoUnavailable: true })
    vi.advanceTimersByTime(VIDEO_UNAVAILABLE_NOTICE_MS)
    expect(useCallStore.getState().videoUnavailable).toBe(false)
  })

  it('callee camera taken by an offer is not reverted', async () => {
    caller = false
    neg.releaseHeldCamera.mockReturnValue(false)
    const t = vtrack()
    gum.mockResolvedValue({ getVideoTracks: () => [t] })
    make().toggleCamera(true)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    vi.advanceTimersByTime(CAMERA_OFFER_WAIT_MS)
    expect(t.stop).not.toHaveBeenCalled()
  })

  it('no pc / camera refused / no track / pc replaced → stays voice', async () => {
    const m = make()
    pc = null
    m.toggleCamera(true)
    await vi.runOnlyPendingTimersAsync()
    expect(gum).not.toHaveBeenCalled()
    pc = { addTrack: vi.fn() }
    gum.mockRejectedValueOnce(new Error('denied'))
    m.toggleCamera(true)
    await vi.runOnlyPendingTimersAsync()
    gum.mockResolvedValueOnce({ getVideoTracks: () => [] })
    m.toggleCamera(true)
    await vi.runOnlyPendingTimersAsync()
    const late = vtrack()
    gum.mockImplementationOnce(async () => { pc = { addTrack: vi.fn() }; return { getVideoTracks: () => [late] } })
    m.toggleCamera(true)
    await vi.runOnlyPendingTimersAsync()
    expect(late.stop).toHaveBeenCalled()
    expect(stream!.addTrack).not.toHaveBeenCalled()
    expect(states()).toEqual([])
  })
})

describe('quality and state', () => {
  it('my quality changes are sent to the peer and attributed', () => {
    make()
    h.qualityCb!('poor')
    expect(states()).toEqual([{ targetId: 'bob', conversationId: 'c1', type: 'state', quality: 'poor' }])
    expect(useCallStore.getState()).toMatchObject({ poorConnection: true, peerPoor: true })
  })

  it('without a target nothing is sent', () => {
    target = null
    make().toggleCamera(false)
    expect(h.publish).not.toHaveBeenCalled()
  })

  it('reset clears pending camera timers', async () => {
    caller = false
    const t = vtrack()
    gum.mockResolvedValue({ getVideoTracks: () => [t] })
    const m = make()
    m.toggleCamera(true)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    m.reset()
    vi.advanceTimersByTime(CAMERA_OFFER_WAIT_MS)
    expect(t.stop).not.toHaveBeenCalled()
    expect(h.qStop).toHaveBeenCalled()
  })

  it('handleState ignores strangers and applies peer camera / quality / restart', () => {
    const m = make()
    m.handleState({ type: 'state', senderId: 'eve', video: true } as never)
    expect(useCallStore.getState().peerCamera).toBe(false)
    m.handleState({ type: 'state', senderId: 'bob', video: true, quality: 'poor', restart: true } as never)
    expect(useCallStore.getState()).toMatchObject({ video: true, peerCamera: true })
    expect(neg.offer).toHaveBeenCalledWith({ iceRestart: false, videoLine: true })
    expect(useCallStore.getState().poorConnection).toBe(true)
  })
})
