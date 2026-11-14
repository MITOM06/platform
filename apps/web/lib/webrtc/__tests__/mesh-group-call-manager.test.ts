import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { publish } = vi.hoisted(() => ({ publish: vi.fn() }))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish } }))

import { MeshGroupCallManager } from '../mesh-group-call-manager'
import { useCallStore } from '@/lib/store/call.store'
import type { GroupCallHooks } from '../call-hooks'
import type { CallParticipant } from '@/lib/api/types'

class FakePC {
  static all: FakePC[] = []
  connectionState = 'new'
  onicecandidate: ((e: { candidate: { toJSON(): unknown } | null }) => void) | null = null
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  addTrack = vi.fn()
  close = vi.fn()
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'OFFER' }))
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'ANSWER' }))
  setLocalDescription = vi.fn(async () => {})
  setRemoteDescription = vi.fn(async () => {})
  addIceCandidate = vi.fn(async (_c: RTCIceCandidateInit) => {})
  constructor(public config: RTCConfiguration) { FakePC.all.push(this) }
  goTo(s: string) { this.connectionState = s; this.onconnectionstatechange?.() }
}

const track = (kind: string) => ({ kind, enabled: true, stop: vi.fn() })
let audio: ReturnType<typeof track>
let video: ReturnType<typeof track>
let stream: MediaStream
const getUserMedia = vi.fn()
let hooks: GroupCallHooks
const origMedia = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
const initialStore = useCallStore.getState()

beforeEach(() => {
  publish.mockReset()
  FakePC.all = []
  audio = track('audio'); video = track('video')
  stream = {
    getTracks: () => [audio, video], getAudioTracks: () => [audio], getVideoTracks: () => [video],
  } as unknown as MediaStream
  getUserMedia.mockReset().mockResolvedValue(stream)
  vi.stubGlobal('RTCPeerConnection', FakePC)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  hooks = { onLocalStream: vi.fn(), onEnded: vi.fn(), onJoinError: null }
  useCallStore.setState(initialStore, true)
})
afterEach(() => {
  vi.unstubAllGlobals()
  if (origMedia) Object.defineProperty(navigator, 'mediaDevices', origMedia)
})

const p = (userId: string, joinedAt?: string, leftAt?: string) =>
  ({ userId, joinedAt, leftAt }) as unknown as CallParticipant

async function joined(m = new MeshGroupCallManager(hooks)) {
  await m.join('call1', 'conv1', 'me', 'video', false)
  return m
}
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('start / join', () => {
  it('startCall acquires media and publishes call.start; confirmStarted joins', async () => {
    const m = new MeshGroupCallManager(hooks)
    await m.startCall('conv1', 'me', 'audio', true)
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false })
    expect(hooks.onLocalStream).toHaveBeenCalledWith(stream)
    expect(publish).toHaveBeenCalledWith('/app/call.start', { conversationId: 'conv1', media: 'audio', aiNotetaker: true })
    expect(m.isActive()).toBe(false)
    await m.confirmStarted('call1', 'conv1', 'me', 'audio', true)
    expect(m.isActive()).toBe(true)
    expect(publish).toHaveBeenLastCalledWith('/app/call.join', { callId: 'call1' })
    expect(useCallStore.getState().groupCallId).toBe('call1')
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(m.getLocalStream()).toBe(stream)
  })

  it('confirmStarted is a no-op unless we started the call', async () => {
    const m = new MeshGroupCallManager(hooks)
    await m.confirmStarted('call1', 'conv1', 'me', 'video', false)
    expect(m.isActive()).toBe(false)
    expect(publish).not.toHaveBeenCalled()
  })

  it('join is idempotent per callId', async () => {
    const m = await joined()
    await m.join('call1', 'conv1', 'me', 'video', false)
    expect(publish.mock.calls.filter((c) => c[0] === '/app/call.join')).toHaveLength(1)
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: true })
  })
})

describe('applyRoster', () => {
  it('is ignored before joining', async () => {
    const m = new MeshGroupCallManager(hooks)
    await m.applyRoster([p('a')])
    expect(FakePC.all).toHaveLength(0)
  })

  it('offers only to peers that joined before us and tears down leavers', async () => {
    const m = await joined()
    publish.mockReset()
    await m.applyRoster([
      p('me', '2026-01-01T10:00:00Z'),
      p('early', '2026-01-01T09:00:00Z'),
      p('noJoinedAt'),
      p('late', '2026-01-01T11:00:00Z'),
      p('gone', '2026-01-01T08:00:00Z', '2026-01-01T09:30:00Z'),
    ])
    expect(useCallStore.getState().roster).toHaveLength(5)
    const offers = publish.mock.calls.filter((c) => c[0] === '/app/call.offer').map((c) => c[1])
    expect(offers).toEqual([
      { callId: 'call1', targetId: 'early', sdp: 'OFFER' },
      { callId: 'call1', targetId: 'noJoinedAt', sdp: 'OFFER' },
    ])
    expect(FakePC.all[0].config.iceServers?.[0].urls).toContain('stun:stun.l.google.com:19302')
    expect(FakePC.all[0].addTrack).toHaveBeenCalledTimes(2)
    // Second roster: 'early' left → closed; no re-offer to existing peers.
    publish.mockReset()
    await m.applyRoster([p('me', '2026-01-01T10:00:00Z'), p('noJoinedAt')])
    expect(FakePC.all[0].close).toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
    expect(m.getRemoteStream('early')).toBeNull()
  })

  it('without our own row, uses now as our join time', async () => {
    const m = await joined()
    publish.mockReset()
    await m.applyRoster([p('past', '2000-01-01T00:00:00Z'), p('future', '2999-01-01T00:00:00Z')])
    const targets = publish.mock.calls.filter((c) => c[0] === '/app/call.offer').map((c) => c[1].targetId)
    expect(targets).toEqual(['past'])
  })
})

describe('peer events', () => {
  it('ICE candidates are relayed with callId + targetId; null candidate ignored', async () => {
    const m = await joined()
    await m.applyRoster([p('a', '2000-01-01T00:00:00Z')])
    publish.mockReset()
    FakePC.all[0].onicecandidate!({ candidate: { toJSON: () => ({ candidate: 'c1' }) } })
    FakePC.all[0].onicecandidate!({ candidate: null })
    expect(publish.mock.calls).toEqual([['/app/call.ice', { callId: 'call1', targetId: 'a', candidate: { candidate: 'c1' } }]])
  })

  it('a remote track stores the stream and marks the group active', async () => {
    const m = await joined()
    await m.applyRoster([p('a', '2000-01-01T00:00:00Z')])
    const remote = {} as MediaStream
    const v = useCallStore.getState().streamsVersion
    FakePC.all[0].ontrack!({ streams: [] })
    expect(m.getRemoteStream('a')).toBeNull()
    FakePC.all[0].ontrack!({ streams: [remote] })
    expect(m.getRemoteStream('a')).toBe(remote)
    expect(useCallStore.getState().groupActive).toBe(true)
    expect(useCallStore.getState().streamsVersion).toBe(v + 1)
  })

  it('failed / disconnected connections close the peer; connected does not', async () => {
    const m = await joined()
    await m.applyRoster([p('a', '2000-01-01T00:00:00Z'), p('b', '2000-01-01T00:00:00Z')])
    FakePC.all[0].goTo('connected')
    expect(FakePC.all[0].close).not.toHaveBeenCalled()
    FakePC.all[0].goTo('failed')
    expect(FakePC.all[0].close).toHaveBeenCalled()
    FakePC.all[1].goTo('disconnected')
    expect(FakePC.all[1].close).toHaveBeenCalled()
  })
})

describe('handleSignal', () => {
  it('ignores signals for another call or without a sender', async () => {
    const m = await joined()
    m.handleSignal({ type: 'offer', callId: 'other', fromId: 'x', sdp: 's' } as never)
    m.handleSignal({ type: 'offer', callId: 'call1', sdp: 's' } as never)
    m.handleSignal({ type: 'offer', fromId: 'x', sdp: 's' } as never)
    await flush()
    expect(FakePC.all).toHaveLength(0)
  })

  it('an offer from a later joiner creates an answering peer and flushes queued ICE', async () => {
    const m = await joined()
    publish.mockReset()
    m.handleSignal({ type: 'offer', callId: 'call1', fromId: 'late', sdp: 'REMOTE' } as never)
    await flush()
    const pc = FakePC.all[0]
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'REMOTE' })
    expect(publish).toHaveBeenCalledWith('/app/call.answer', { callId: 'call1', targetId: 'late', sdp: 'ANSWER' })
    m.handleSignal({ type: 'ice', callId: 'call1', fromId: 'late', candidate: { candidate: 'x' } } as never)
    await flush()
    expect(pc.addIceCandidate).toHaveBeenCalledWith({ candidate: 'x' })
  })

  it('an offer without sdp uses an empty string', async () => {
    const m = await joined()
    m.handleSignal({ type: 'offer', callId: 'call1', fromId: 'late' } as never)
    await flush()
    expect(FakePC.all[0].setRemoteDescription).toHaveBeenCalledWith({ type: 'offer', sdp: '' })
  })

  it('ICE before the answer is queued, then flushed (bad candidates ignored)', async () => {
    const m = await joined()
    await m.applyRoster([p('a', '2000-01-01T00:00:00Z')])
    const pc = FakePC.all[0]
    pc.addIceCandidate.mockRejectedValueOnce(new Error('bad'))
    m.handleSignal({ type: 'ice', callId: 'call1', fromId: 'a', candidate: { candidate: 'c1' } } as never)
    m.handleSignal({ type: 'ice', callId: 'call1', fromId: 'a', candidate: { candidate: 'c2' } } as never)
    m.handleSignal({ type: 'ice', callId: 'call1', fromId: 'a' } as never)
    await flush()
    expect(pc.addIceCandidate).not.toHaveBeenCalled()
    m.handleSignal({ type: 'answer', callId: 'call1', fromId: 'a', sdp: 'ANS' } as never)
    await flush()
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: 'answer', sdp: 'ANS' })
    expect(pc.addIceCandidate.mock.calls.map((c) => c[0])).toEqual([{ candidate: 'c1' }, { candidate: 'c2' }])
    pc.addIceCandidate.mockRejectedValueOnce(new Error('bad'))
    m.handleSignal({ type: 'ice', callId: 'call1', fromId: 'a', candidate: { candidate: 'c3' } } as never)
    await flush()
    expect(pc.addIceCandidate).toHaveBeenLastCalledWith({ candidate: 'c3' })
  })

  it('answers / ICE from unknown peers are ignored', async () => {
    const m = await joined()
    m.handleSignal({ type: 'answer', callId: 'call1', fromId: 'ghost', sdp: 's' } as never)
    m.handleSignal({ type: 'ice', callId: 'call1', fromId: 'ghost', candidate: { candidate: 'c' } } as never)
    m.handleSignal({ type: 'end', callId: 'call1', fromId: 'ghost' } as never)
    await flush()
    expect(FakePC.all).toHaveLength(0)
  })
})

describe('media toggles and teardown', () => {
  it('toggles tracks and mirrors state in the store', async () => {
    const m = await joined()
    m.toggleMic(false)
    m.toggleCamera(false)
    expect(audio.enabled).toBe(false)
    expect(video.enabled).toBe(false)
    expect(useCallStore.getState().micEnabled).toBe(false)
    expect(useCallStore.getState().cameraEnabled).toBe(false)
  })

  it('toggles without a stream only update the store', () => {
    const m = new MeshGroupCallManager(hooks)
    m.toggleMic(false)
    expect(useCallStore.getState().micEnabled).toBe(false)
  })

  it('leave publishes call.leave, closes peers, stops media and resets', async () => {
    const m = await joined()
    await m.applyRoster([p('a', '2000-01-01T00:00:00Z')])
    m.leave()
    expect(publish).toHaveBeenCalledWith('/app/call.leave', { callId: 'call1' })
    expect(FakePC.all[0].close).toHaveBeenCalled()
    expect(audio.stop).toHaveBeenCalled()
    expect(hooks.onEnded).toHaveBeenCalled()
    expect(hooks.onLocalStream).toBeNull()
    expect(m.isActive()).toBe(false)
    expect(m.getLocalStream()).toBeNull()
    expect(useCallStore.getState().groupCallId).toBeNull()
  })

  it('leave before joining does not publish', () => {
    const m = new MeshGroupCallManager(hooks)
    m.leave()
    expect(publish).not.toHaveBeenCalled()
    expect(hooks.onEnded).toHaveBeenCalled()
  })

  it('handleEnded tears down only the matching call, without publishing leave', async () => {
    const m = await joined()
    m.handleEnded('other')
    expect(m.isActive()).toBe(true)
    publish.mockReset()
    m.handleEnded('call1')
    expect(m.isActive()).toBe(false)
    expect(publish).not.toHaveBeenCalled()
  })
})
