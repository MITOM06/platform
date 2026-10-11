import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  callSignal: vi.fn(),
  groupSignal: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock('@/lib/webrtc/call-manager', () => ({ callManager: { handleSignal: m.callSignal } }))
vi.mock('@/lib/webrtc/group-call-manager', () => ({ groupCallManager: { handleSignal: m.groupSignal } }))
vi.mock('sonner', () => ({ toast: { error: m.toastError } }))

import { handleWebRtcFrame } from '../session-handlers'
import { useCallStore } from '@/lib/store/call.store'

const t = (key: string) => `chat.${key}`
/** The handlers lazy-load the managers: let those imports settle. */
const flush = () => new Promise((r) => setTimeout(r, 0))
const frame = (signal: object) => handleWebRtcFrame(JSON.stringify(signal), t)

beforeEach(() => {
  m.callSignal.mockClear()
  m.groupSignal.mockClear()
  m.toastError.mockClear()
  useCallStore.getState().reset()
  useCallStore.getState().resetGroup()
})

describe('/user/queue/webrtc routing', () => {
  it('call-merged reaches the 1-on-1 engine even though it carries a callId', async () => {
    const signal = {
      type: 'call-merged',
      callId: 'c-a',
      conversationId: 'conv',
      senderId: 'alice',
      media: 'video',
      transport: 'sfu',
      kind: 'direct',
    }
    frame(signal)
    await flush()
    expect(m.callSignal).toHaveBeenCalledWith(signal)
    expect(m.groupSignal).not.toHaveBeenCalled()
  })

  it('call-accepted (the callee answered) reaches the 1-on-1 engine', async () => {
    const signal = { type: 'call-accepted', callId: 'c1', conversationId: 'conv', senderId: 'bob' }
    frame(signal)
    await flush()
    expect(m.callSignal).toHaveBeenCalledWith(signal)
    expect(m.groupSignal).not.toHaveBeenCalled()
  })

  it('mesh group signaling (offer with a callId) still goes to the group manager', async () => {
    const signal = { type: 'offer', callId: 'g1', fromId: 'bob', sdp: 'v=0' }
    frame(signal)
    await flush()
    expect(m.groupSignal).toHaveBeenCalledWith(signal)
    expect(m.callSignal).not.toHaveBeenCalled()
  })

  it('call-blocked explains it and lets the 1-on-1 engine tear its call down', async () => {
    const signal = { type: 'call-blocked', conversationId: 'conv', senderId: 'me' }
    frame(signal)
    await flush()
    expect(m.toastError).toHaveBeenCalledWith('chat.callBlocked')
    expect(m.callSignal).toHaveBeenCalledWith(signal)
  })
})
