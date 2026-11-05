import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const publish = vi.fn()
vi.mock('@/lib/stomp/client', () => ({ stompService: { publish: (...a: unknown[]) => publish(...a) } }))

import { useMeetingTranscriber } from '@/lib/meetings/use-meeting-transcriber'
import { FakeRecognition, installFakeSpeech, removeFakeSpeech } from './fake-speech'

const rec = () => FakeRecognition.instances[FakeRecognition.instances.length - 1]

beforeEach(() => {
  publish.mockReset()
  installFakeSpeech()
})
afterEach(removeFakeSpeech)

describe('useMeetingTranscriber', () => {
  it('publishes final results to /app/meet.transcript while active', () => {
    renderHook(() => useMeetingTranscriber('m1', true))
    act(() => rec().emit('hello team', true))
    expect(publish).toHaveBeenCalledWith('/app/meet.transcript', { meetingId: 'm1', text: 'hello team', ts: expect.any(Number) })
  })

  it('ignores interim results', () => {
    renderHook(() => useMeetingTranscriber('m1', true))
    act(() => rec().emit('hel', false))
    expect(publish).not.toHaveBeenCalled()
  })

  it('stops publishing when paused and resumes after', () => {
    const { result } = renderHook(() => useMeetingTranscriber('m1', true))
    const first = rec()
    act(() => result.current.setPaused(true))
    expect(first.stop).toHaveBeenCalled()
    expect(result.current.paused).toBe(true)
    act(() => first.emit('while paused', true))
    expect(publish).not.toHaveBeenCalled()
    act(() => result.current.setPaused(false))
    expect(rec()).not.toBe(first)
    act(() => rec().emit('back', true))
    expect(publish).toHaveBeenCalledTimes(1)
  })

  it('stops when active turns false (AI notes switched off)', () => {
    const { rerender } = renderHook((p: { a: boolean }) => useMeetingTranscriber('m1', p.a), { initialProps: { a: true } })
    const r = rec()
    rerender({ a: false })
    expect(r.stop).toHaveBeenCalled()
    act(() => r.emit('late', true))
    expect(publish).not.toHaveBeenCalled()
    expect(FakeRecognition.instances).toHaveLength(1)
  })

  it('reports supported=false and never throws without SpeechRecognition', () => {
    removeFakeSpeech()
    const { result } = renderHook(() => useMeetingTranscriber('m1', true))
    expect(result.current.supported).toBe(false)
  })
})
