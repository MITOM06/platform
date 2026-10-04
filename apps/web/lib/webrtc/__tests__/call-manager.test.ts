import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { publish, sendMessage } = vi.hoisted(() => ({
  publish: vi.fn(),
  sendMessage: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish } }))
vi.mock('@/lib/api/chat', () => ({ chatService: { sendMessage } }))

import { callManager, RING_TIMEOUT_MS } from '../call-manager'
import { useCallStore } from '@/lib/store/call.store'

class FakePeerConnection {
  connectionState = 'new'
  onicecandidate: unknown = null
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null
  onconnectionstatechange: unknown = null
  addTrack = vi.fn()
  close = vi.fn()
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0' }))
  setLocalDescription = vi.fn(async () => {})
  setRemoteDescription = vi.fn(async () => {})
}

const fakeStream = { getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] }
const getUserMedia = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  publish.mockClear()
  sendMessage.mockClear()
  getUserMedia.mockReset().mockResolvedValue(fakeStream)
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })
  useCallStore.getState().reset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const endSignals = () => publish.mock.calls.filter(([dest]) => dest === '/app/call.end')

describe('callManager outgoing ring', () => {
  it('gives up after the ring timeout: notifies the callee, logs a missed call, resets the UI', async () => {
    const onNoAnswer = vi.fn()
    callManager.onNoAnswer = onNoAnswer
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    expect(useCallStore.getState().status).toBe('outgoing')

    vi.advanceTimersByTime(RING_TIMEOUT_MS - 1)
    expect(useCallStore.getState().status).toBe('outgoing')

    vi.advanceTimersByTime(1)
    expect(useCallStore.getState().status).toBe('idle')
    expect(endSignals()).toHaveLength(1)
    expect(endSignals()[0][1]).toMatchObject({ targetId: 'bob', conversationId: 'conv-1', type: 'end' })
    expect(sendMessage).toHaveBeenCalledWith('conv-1', 'system.call.missed:voice', 'system')
    expect(onNoAnswer).toHaveBeenCalledOnce()
    callManager.onNoAnswer = null
  })

  it('a decline from the callee ends the call and cancels the ring timer', async () => {
    await callManager.startCall('bob', 'Bob', 'conv-1', false)
    callManager.handleSignal({ type: 'end', senderId: 'bob' })
    expect(useCallStore.getState().status).toBe('idle')

    vi.advanceTimersByTime(RING_TIMEOUT_MS)
    expect(endSignals()).toHaveLength(0)
  })

  it('does not leave the caller on "Calling…" when the mic/camera cannot be opened', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'))
    await expect(callManager.startCall('bob', 'Bob', 'conv-1', true)).rejects.toThrow()
    expect(useCallStore.getState().status).toBe('idle')
    expect(publish).not.toHaveBeenCalled()
  })
})
