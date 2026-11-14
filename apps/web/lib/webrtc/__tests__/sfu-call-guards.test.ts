/** SfuDirectCall ignores malformed / out-of-state signals and idle commands. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  publish: vi.fn(),
  room: { localStream: vi.fn(() => 'LOCAL'), remoteStream: vi.fn(() => 'REMOTE'), close: vi.fn(), join: vi.fn(), setMic: vi.fn(), setCamera: vi.fn() },
}))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish: h.publish, subscribe: vi.fn(() => undefined), subscribeDurable: vi.fn(() => () => {}) } }))
vi.mock('../sfu-call-room', () => ({ SfuCallRoom: class { constructor() { return h.room } } }))
vi.mock('../call-transport', () => ({ refreshCallTransport: vi.fn() }))

import { SfuDirectCall } from '../sfu-call'
import { useCallStore } from '@/lib/store/call.store'
import type { CallHooks } from '../call-hooks'

const initial = useCallStore.getState()
let hooks: CallHooks
beforeEach(() => {
  useCallStore.setState(initial, true)
  h.publish.mockReset()
  hooks = { onLocalStream: null, onRemoteStream: null, onEnded: vi.fn(), onEndNotice: vi.fn() }
})

describe('SfuDirectCall guards', () => {
  it('streams come from the room', () => {
    const c = new SfuDirectCall(hooks)
    expect(c.getLocalStream()).toBe('LOCAL')
    expect(c.getRemoteStream()).toBe('REMOTE')
  })

  it('endCall / dismissIncoming while idle do nothing', () => {
    const c = new SfuDirectCall(hooks)
    c.endCall()
    c.dismissIncoming()
    expect(h.publish).not.toHaveBeenCalled()
    expect(hooks.onEndNotice).not.toHaveBeenCalled()
    expect(hooks.onEnded).not.toHaveBeenCalled()
  })

  it.each(['call-ring', 'call-merged'] as const)('%s without callId / conversation / sender is ignored', (type) => {
    const c = new SfuDirectCall(hooks)
    c.handleSignal({ type, conversationId: 'c1', senderId: 'bob' } as never)
    c.handleSignal({ type, callId: 'k', senderId: 'bob' } as never)
    c.handleSignal({ type, callId: 'k', conversationId: 'c1' } as never)
    expect(useCallStore.getState().status).toBe('idle')
    expect(h.publish).not.toHaveBeenCalled()
  })

  it('a merge for a call we are not placing is ignored', () => {
    const c = new SfuDirectCall(hooks)
    c.handleSignal({ type: 'call-merged', callId: 'k', conversationId: 'c1', senderId: 'bob' } as never)
    expect(useCallStore.getState().status).toBe('idle')
  })

  it('blocked / declined without a pending outgoing call change nothing', () => {
    const c = new SfuDirectCall(hooks)
    c.handleSignal({ type: 'call-blocked', conversationId: 'c1' } as never)
    c.handleSignal({ type: 'call-declined', callId: 'k', reason: 'declined' } as never)
    expect(useCallStore.getState().status).toBe('idle')
    expect(hooks.onEndNotice).not.toHaveBeenCalled()
  })

  it('a ring with all fields shows the incoming prompt', () => {
    const c = new SfuDirectCall(hooks)
    c.handleSignal({ type: 'call-ring', callId: 'k', conversationId: 'c1', senderId: 'bob', media: 'audio' } as never)
    expect(useCallStore.getState()).toMatchObject({ status: 'incoming', peerId: 'bob', conversationId: 'c1', transport: 'sfu' })
  })
})
