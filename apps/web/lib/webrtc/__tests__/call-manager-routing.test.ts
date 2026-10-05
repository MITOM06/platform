import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  publish: vi.fn(),
  transport: { value: 'mesh' as 'mesh' | 'sfu' },
}))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish: m.publish } }))
vi.mock('@/lib/api/chat', () => ({ chatService: { sendMessage: vi.fn(() => Promise.resolve()) } }))
vi.mock('@/lib/api/calls', () => ({ callsApi: { getToken: vi.fn() } }))
vi.mock('../call-transport', () => ({ getCallTransport: () => m.transport.value }))

import { callManager } from '../call-manager'
import { useCallStore } from '@/lib/store/call.store'

beforeEach(() => {
  useCallStore.getState().reset()
  m.publish.mockClear()
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] })) },
    configurable: true,
  })
  vi.stubGlobal(
    'RTCPeerConnection',
    class {
      addTrack = vi.fn()
      close = vi.fn()
      createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0' }))
      setLocalDescription = vi.fn(async () => {})
    },
  )
})

describe('callManager routing', () => {
  it('places a new call on sfu when the server runs sfu', async () => {
    m.transport.value = 'sfu'
    await callManager.startCall('bob', 'Bob', 'conv', false)
    expect(m.publish.mock.calls.map(([d]) => d)).toEqual(['/app/call.start'])
    expect(useCallStore.getState().transport).toBe('sfu')
    callManager.endCall()
  })

  it('places a new call on mesh otherwise', async () => {
    m.transport.value = 'mesh'
    await callManager.startCall('bob', 'Bob', 'conv', false)
    expect(m.publish.mock.calls.map(([d]) => d)).toEqual(['/app/call.offer'])
    callManager.endCall()
  })

  it('routes an sfu ring to the sfu engine', () => {
    callManager.handleSignal({
      type: 'call-ring',
      callId: 'c1',
      conversationId: 'conv',
      senderId: 'alice',
      media: 'audio',
      transport: 'sfu',
      kind: 'direct',
    })
    expect(useCallStore.getState().status).toBe('incoming')
    expect(useCallStore.getState().callId).toBe('c1')
    callManager.endCall('declined')
    expect(m.publish).toHaveBeenCalledWith('/app/call.decline', { callId: 'c1', reason: 'declined' })
  })
})
