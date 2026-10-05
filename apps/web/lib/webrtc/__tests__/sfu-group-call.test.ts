import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => {
  class FakeSession {
    static last: FakeSession | null = null
    onLocalStream: ((s: MediaStream) => void) | null = null
    onPeersChanged: ((peers: { identity: string; speaking: boolean }[]) => void) | null = null
    onReconnecting: ((on: boolean) => void) | null = null
    onLocalPoorConnection: ((p: boolean) => void) | null = null
    onDisconnected: ((r: 'failed') => void) | null = null
    streams = new Map<string, MediaStream>()
    connect = vi.fn<(u: string, t: string, o: { video: boolean }) => Promise<unknown>>(async () => {})
    disconnect = vi.fn()
    setMic = vi.fn<(on: boolean) => Promise<unknown>>(async () => {})
    setCamera = vi.fn<(on: boolean) => Promise<unknown>>(async () => {})
    localStream = () => null
    peer = (id: string) => (this.streams.has(id) ? { stream: this.streams.get(id)! } : undefined)
    constructor() {
      FakeSession.last = this
    }
  }
  return {
    FakeSession,
    publish: vi.fn(),
    getToken: vi.fn<(c: string) => Promise<unknown>>(async () => ({ url: 'wss://rtc', token: 'tok' })),
    transport: { value: 'sfu' as 'mesh' | 'sfu' },
  }
})
vi.mock('@/lib/stomp/client', () => ({
  stompService: { publish: m.publish, subscribe: vi.fn(() => undefined) },
}))
vi.mock('@/lib/api/calls', () => ({ callsApi: { getToken: m.getToken } }))
vi.mock('@/lib/rtc/livekit-session', () => ({ LiveKitSession: m.FakeSession, MediaAccessError: class extends Error {} }))
vi.mock('../call-transport', () => ({ getCallTransport: () => m.transport.value }))

import { groupCallManager } from '../group-call-manager'
import { useCallStore } from '@/lib/store/call.store'

const store = () => useCallStore.getState()
const sent = (dest: string) => m.publish.mock.calls.filter(([d]) => d === dest).map(([, b]) => b)
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  groupCallManager.leave()
  store().resetGroup()
  m.publish.mockClear()
  m.getToken.mockClear()
  m.FakeSession.last = null
  m.transport.value = 'sfu'
})

describe('group calls on sfu', () => {
  it('the starter enters the room once call.started arrives — no call.join', async () => {
    await groupCallManager.startCall('grp', 'me', 'video', false)
    expect(sent('/app/call.start')).toEqual([{ conversationId: 'grp', media: 'video', aiNotetaker: false }])

    await groupCallManager.confirmStarted('c1', 'grp', 'me', 'video', false, 'sfu')
    await flush()
    expect(store().groupCallId).toBe('c1')
    expect(store().groupTransport).toBe('sfu')
    expect(m.FakeSession.last!.connect).toHaveBeenCalledWith('wss://rtc', 'tok', { video: true })
    expect(sent('/app/call.join')).toEqual([])
  })

  it('an invitee answers with call.accept and enters the room', async () => {
    await groupCallManager.join('c1', 'grp', 'me', 'audio', false, 'sfu')
    await flush()
    expect(sent('/app/call.accept')).toEqual([{ callId: 'c1' }])
    expect(m.FakeSession.last!.connect).toHaveBeenCalledWith('wss://rtc', 'tok', { video: false })
  })

  it('peers going live mark the call active, track speakers and refresh tiles', async () => {
    await groupCallManager.join('c1', 'grp', 'me', 'audio', false, 'sfu')
    await flush()
    const before = store().streamsVersion
    const stream = {} as MediaStream
    m.FakeSession.last!.streams.set('bob', stream)
    m.FakeSession.last!.onPeersChanged!([{ identity: 'bob', speaking: true }])

    expect(store().groupActive).toBe(true)
    expect(store().speakingIds).toEqual(['bob'])
    expect(store().streamsVersion).toBeGreaterThan(before)
    expect(groupCallManager.getRemoteStream('bob')).toBe(stream)
  })

  it('leaving tells the server and resets', async () => {
    await groupCallManager.join('c1', 'grp', 'me', 'audio', false, 'sfu')
    await flush()
    groupCallManager.leave()
    expect(sent('/app/call.leave')).toEqual([{ callId: 'c1' }])
    expect(m.FakeSession.last!.disconnect).toHaveBeenCalled()
    expect(store().groupCallId).toBeNull()
  })

  it('the server ending the call tears it down', async () => {
    await groupCallManager.join('c1', 'grp', 'me', 'audio', false, 'sfu')
    await flush()
    groupCallManager.handleEnded('c1')
    expect(store().groupCallId).toBeNull()
    expect(sent('/app/call.leave')).toEqual([])
  })

  it('declining an sfu ring tells the server; a mesh ring stays silent', () => {
    const ring = { callId: 'c1', conversationId: 'grp', startedBy: 'a', startedByName: 'a', media: 'audio' as const, aiNotetaker: false }
    store().setIncomingGroupCall({ ...ring, transport: 'sfu' })
    groupCallManager.declineRing({ ...ring, transport: 'sfu' })
    expect(sent('/app/call.decline')).toEqual([{ callId: 'c1', reason: 'declined' }])
    expect(store().incomingGroupCall).toBeNull()

    m.publish.mockClear()
    groupCallManager.declineRing({ ...ring, transport: 'mesh' })
    expect(m.publish).not.toHaveBeenCalled()
  })

  it('leaving clears the shared reconnecting / poor-connection flags', async () => {
    await groupCallManager.join('c1', 'grp', 'me', 'audio', false, 'sfu')
    await flush()
    m.FakeSession.last!.onReconnecting!(true)
    groupCallManager.leave()
    expect(store().reconnecting).toBe(false)
    expect(store().poorConnection).toBe(false)
  })

  it('a room the server closed tears the call down without a leave', async () => {
    await groupCallManager.join('c1', 'grp', 'me', 'audio', false, 'sfu')
    await flush()
    m.publish.mockClear()
    m.FakeSession.last!.onDisconnected!('ended' as never)
    expect(store().groupCallId).toBeNull()
    expect(sent('/app/call.leave')).toEqual([])
  })
})

