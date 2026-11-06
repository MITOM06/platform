/**
 * /user/queue/webrtc routing for every signal kind + the /topic/presence handler
 * (offline removes immediately, online debounces one refetch). Complements
 * session-handlers.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

const m = vi.hoisted(() => ({
  callSignal: vi.fn(),
  groupSignal: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock('@/lib/webrtc/call-manager', () => ({ callManager: { handleSignal: m.callSignal } }))
vi.mock('@/lib/webrtc/group-call-manager', () => ({ groupCallManager: { handleSignal: m.groupSignal } }))
vi.mock('sonner', () => ({ toast: { error: m.toastError } }))

import { createPresenceHandler, handleWebRtcFrame } from '../session-handlers'
import { useCallStore } from '@/lib/store/call.store'

const t = (key: string) => `chat.${key}`
const flush = () => new Promise((r) => setTimeout(r, 0))
const frame = (signal: object) => handleWebRtcFrame(JSON.stringify(signal), t)

beforeEach(() => {
  vi.clearAllMocks()
  useCallStore.getState().reset()
  useCallStore.getState().resetGroup()
})

describe('handleWebRtcFrame', () => {
  it('ignores a malformed frame', async () => {
    handleWebRtcFrame('{oops', t)
    await flush()
    expect(m.callSignal).not.toHaveBeenCalled()
    expect(m.groupSignal).not.toHaveBeenCalled()
  })

  it('a 1-on-1 LiveKit ring goes to the call manager, not the group prompt', async () => {
    frame({ type: 'call-ring', transport: 'sfu', kind: 'direct', callId: 'k1', senderId: 'bob' })
    await flush()
    expect(m.callSignal).toHaveBeenCalledWith(expect.objectContaining({ callId: 'k1' }))
    expect(useCallStore.getState().incomingGroupCall).toBeNull()
  })

  it('a stray mesh "direct" ring is dropped', async () => {
    frame({ type: 'call-ring', transport: 'mesh', kind: 'direct', callId: 'k1' })
    await flush()
    expect(m.callSignal).not.toHaveBeenCalled()
    expect(m.groupSignal).not.toHaveBeenCalled()
  })

  it('call-declined reaches the 1-on-1 engine', async () => {
    frame({ type: 'call-declined', callId: 'k1' })
    await flush()
    expect(m.callSignal).toHaveBeenCalledWith(expect.objectContaining({ type: 'call-declined' }))
    expect(m.groupSignal).not.toHaveBeenCalled()
  })

  it('a group ring opens the incoming prompt with safe defaults', () => {
    frame({
      type: 'call-ring',
      kind: 'group',
      callId: 'g1',
      conversationId: 'c1',
      senderId: 'bob',
      startedByName: 'Bob',
      transport: 'sfu',
    })
    expect(useCallStore.getState().incomingGroupCall).toEqual({
      callId: 'g1',
      conversationId: 'c1',
      startedBy: 'bob',
      startedByName: 'Bob',
      media: 'video',
      aiNotetaker: false,
      transport: 'sfu',
    })
  })

  it('a group ring is ignored while I am already in a call', () => {
    useCallStore.setState({ groupCallId: 'other' })
    frame({ type: 'call-ring', kind: 'group', callId: 'g1', conversationId: 'c1' })
    expect(useCallStore.getState().incomingGroupCall).toBeNull()

    useCallStore.setState({ groupCallId: null, status: 'connected' })
    frame({ type: 'call-ring', kind: 'group', callId: 'g1', conversationId: 'c1' })
    expect(useCallStore.getState().incomingGroupCall).toBeNull()
  })

  it('a ring cancel for the prompted group call closes the prompt; any other goes to the 1-on-1 engine', async () => {
    frame({ type: 'call-ring', kind: 'group', callId: 'g1', conversationId: 'c1' })
    expect(useCallStore.getState().incomingGroupCall?.callId).toBe('g1')

    frame({ type: 'call-ring-cancel', callId: 'g1' })
    expect(useCallStore.getState().incomingGroupCall).toBeNull()
    await flush()
    expect(m.callSignal).not.toHaveBeenCalled()

    frame({ type: 'call-ring-cancel', callId: 'k9' })
    await flush()
    expect(m.callSignal).toHaveBeenCalledWith(expect.objectContaining({ callId: 'k9' }))
  })

  it('a legacy 1-on-1 signal without callId goes to the call manager', async () => {
    frame({ type: 'offer', sdp: 'x', senderId: 'bob' })
    await flush()
    expect(m.callSignal).toHaveBeenCalledWith(expect.objectContaining({ type: 'offer' }))
    expect(m.groupSignal).not.toHaveBeenCalled()
  })
})

describe('createPresenceHandler', () => {
  let qc: QueryClient

  beforeEach(() => {
    vi.useFakeTimers()
    qc = new QueryClient()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('offline removes that friend from the cached list immediately (id or _id)', () => {
    qc.setQueryData(['onlineFriends'], [{ id: 'a' }, { _id: 'b' }, { id: 'c' }])
    const p = createPresenceHandler(qc)
    p.handle(JSON.stringify({ userId: 'b', online: false }))
    p.handle(JSON.stringify({ userId: 'a', online: false }))
    expect(qc.getQueryData(['onlineFriends'])).toEqual([{ id: 'c' }])
  })

  it('offline with no cached list leaves it empty', () => {
    const p = createPresenceHandler(qc)
    p.handle(JSON.stringify({ userId: 'b', online: false }))
    expect(qc.getQueryData(['onlineFriends'])).toBeUndefined()
  })

  it('a burst of online events triggers ONE refetch after 400ms', () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const p = createPresenceHandler(qc)
    p.handle(JSON.stringify({ userId: 'a', online: true }))
    vi.advanceTimersByTime(300)
    p.handle(JSON.stringify({ userId: 'b', online: true }))
    vi.advanceTimersByTime(399)
    expect(invalidate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['onlineFriends'] })
  })

  it('dispose cancels a pending refetch; malformed frames are ignored', () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const p = createPresenceHandler(qc)
    p.handle('not json')
    p.handle(JSON.stringify({ userId: 'a', online: true }))
    p.dispose()
    vi.advanceTimersByTime(1000)
    expect(invalidate).not.toHaveBeenCalled()
    p.dispose() // idempotent
  })
})
