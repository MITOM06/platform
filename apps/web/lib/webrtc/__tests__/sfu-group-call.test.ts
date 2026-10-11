import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => {
  class MediaAccessError extends Error {}
  class FakeSession {
    static last: FakeSession | null = null
    static connectError: Error | null = null
    /** When set, the next connect() waits for it (a join still in flight). */
    static gate: Promise<void> | null = null
    /** What this device publishes: connect() opens what it is asked to, set*() changes it. */
    mic = false
    camera = false
    onLocalStream: ((s: MediaStream) => void) | null = null
    onPeersChanged: ((peers: { identity: string; speaking: boolean }[]) => void) | null = null
    onReconnecting: ((on: boolean) => void) | null = null
    onLocalPoorConnection: ((p: boolean) => void) | null = null
    onDisconnected: ((r: 'failed') => void) | null = null
    streams = new Map<string, MediaStream>()
    connect = vi.fn<(u: string, t: string, o: { video: boolean; audio?: boolean }) => Promise<unknown>>(
      async (_u, _t, opts) => {
        const gate = FakeSession.gate
        FakeSession.gate = null
        if (gate) await gate
        const e = FakeSession.connectError
        FakeSession.connectError = null
        if (e) throw e
        this.mic = opts.audio !== false
        this.camera = opts.video
      },
    )
    disconnect = vi.fn()
    setMic = vi.fn<(on: boolean) => Promise<unknown>>(async (on) => {
      this.mic = on
    })
    setCamera = vi.fn<(on: boolean) => Promise<unknown>>(async (on) => {
      this.camera = on
    })
    localStream = () => null
    peer = (id: string) => (this.streams.has(id) ? { stream: this.streams.get(id)! } : undefined)
    constructor() {
      FakeSession.last = this
    }
  }
  return {
    FakeSession,
    MediaAccessError,
    publish: vi.fn(),
    getToken: vi.fn<(c: string) => Promise<unknown>>(async () => ({ url: 'wss://rtc', token: 'tok' })),
    transport: { value: 'sfu' as 'mesh' | 'sfu' },
  }
})
vi.mock('@/lib/stomp/client', () => ({
  stompService: { publish: m.publish, subscribe: vi.fn(() => undefined) },
}))
vi.mock('@/lib/api/calls', () => ({ callsApi: { getToken: m.getToken } }))
vi.mock('@/lib/rtc/livekit-session', () => ({ LiveKitSession: m.FakeSession, MediaAccessError: m.MediaAccessError }))
vi.mock('../call-transport', () => ({ getCallTransport: () => m.transport.value }))

import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { groupCallManager } from '../group-call-manager'
import { useCallStore } from '@/lib/store/call.store'

const store = () => useCallStore.getState()
const sent = (dest: string) => m.publish.mock.calls.filter(([d]) => d === dest).map(([, b]) => b)
const flush = () => new Promise((r) => setTimeout(r, 0))
const joinError = vi.fn()

beforeEach(() => {
  groupCallManager.leave()
  store().resetGroup()
  m.publish.mockClear()
  m.getToken.mockClear()
  m.FakeSession.last = null
  m.FakeSession.gate = null
  m.FakeSession.connectError = null
  m.transport.value = 'sfu'
  joinError.mockClear()
  groupCallManager.onJoinError = joinError
})

describe('group calls on sfu', () => {
  it('the starter enters the room once call.started arrives — no call.join', async () => {
    await groupCallManager.startCall('grp', 'me', 'video', false)
    expect(sent('/app/call.start')).toEqual([{ conversationId: 'grp', media: 'video', aiNotetaker: false }])

    await groupCallManager.confirmStarted('c1', 'grp', 'me', 'video', false, 'sfu')
    await flush()
    expect(store().groupCallId).toBe('c1')
    expect(store().groupTransport).toBe('sfu')
    expect(m.FakeSession.last!.connect).toHaveBeenCalledWith('wss://rtc', 'tok', { video: true, audio: true })
    expect(sent('/app/call.join')).toEqual([])
  })

  it('an invitee answers with call.accept and enters the room', async () => {
    await groupCallManager.join('c1', 'grp', 'me', 'audio', false, 'sfu')
    await flush()
    expect(sent('/app/call.accept')).toEqual([{ callId: 'c1' }])
    expect(m.FakeSession.last!.connect).toHaveBeenCalledWith('wss://rtc', 'tok', { video: false, audio: true })
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

function httpErr(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}
function deferred() {
  let release!: () => void
  const promise = new Promise<void>((r) => (release = r))
  return { promise, release }
}

describe('group calls on sfu: mute / camera chosen before the room is joined', () => {
  it('a mute made while the join is in flight is not undone by it', async () => {
    const gate = deferred()
    m.FakeSession.gate = gate.promise
    const joining = groupCallManager.join('c1', 'grp', 'me', 'video', false, 'sfu')
    await flush() // token in; connect() still waiting
    groupCallManager.toggleMic(false)
    groupCallManager.toggleCamera(false)
    gate.release()
    await joining
    expect(m.FakeSession.last!.mic).toBe(false)
    expect(m.FakeSession.last!.camera).toBe(false)
  })

  it('a mute made before the token arrived is joined with', async () => {
    const joining = groupCallManager.join('c1', 'grp', 'me', 'video', false, 'sfu')
    groupCallManager.toggleMic(false)
    await joining
    expect(m.FakeSession.last!.mic).toBe(false)
    expect(m.FakeSession.last!.camera).toBe(true)
  })
})

describe('group calls on sfu: a failed join says why', () => {
  it('calls being unavailable (503)', async () => {
    m.getToken.mockRejectedValueOnce(httpErr(503, { error: 'x', code: 'CALLS_UNAVAILABLE', statusCode: 503 }))
    await groupCallManager.join('c1', 'grp', 'me', 'audio', false, 'sfu')
    expect(joinError).toHaveBeenCalledWith('errUnavailable')
    expect(store().groupCallId).toBeNull()
  })

  it('a refused microphone / camera', async () => {
    m.FakeSession.connectError = new m.MediaAccessError()
    await groupCallManager.join('c1', 'grp', 'me', 'video', false, 'sfu')
    expect(joinError).toHaveBeenCalledWith('mediaError')
    expect(store().groupCallId).toBeNull()
    expect(sent('/app/call.leave')).toEqual([{ callId: 'c1' }])
  })

  it('any other room failure', async () => {
    m.FakeSession.connectError = new Error('room')
    await groupCallManager.join('c1', 'grp', 'me', 'audio', false, 'sfu')
    expect(joinError).toHaveBeenCalledWith('errFailed')
  })
})

