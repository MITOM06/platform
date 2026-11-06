import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const publish = vi.fn()
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish: (...a: unknown[]) => publish(...a) } }))

import { useCallTranscriber } from '@/lib/hooks/use-call-transcriber'
import { FakeRecognition, installFakeSpeech, removeFakeSpeech } from '@/lib/meetings/__tests__/fake-speech'

beforeEach(() => {
  publish.mockReset()
  installFakeSpeech()
})
afterEach(removeFakeSpeech)

describe('useCallTranscriber', () => {
  it('still publishes /app/call.transcript on final results', () => {
    renderHook(() => useCallTranscriber('c1', true, 'vi-VN'))
    const rec = FakeRecognition.instances[0]
    expect(rec.lang).toBe('vi-VN')
    act(() => rec.emit('xin chao', true))
    expect(publish).toHaveBeenCalledWith('/app/call.transcript', { callId: 'c1', text: 'xin chao', ts: expect.any(Number) })
  })

  it('does nothing without a callId or when disabled', () => {
    renderHook(() => useCallTranscriber(null, true))
    renderHook(() => useCallTranscriber('c1', false))
    expect(FakeRecognition.instances).toHaveLength(0)
  })
})
