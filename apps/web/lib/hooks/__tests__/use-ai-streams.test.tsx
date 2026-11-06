/**
 * Per-reply AI bubbles with a 30s watchdog each: a reply that never finishes
 * cannot spin forever, one reply ending never touches another, and switching
 * conversation clears every bubble and timer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AI_STREAM_WATCHDOG_MS, useAiStreams } from '@/lib/hooks/use-ai-streams'
import { LOCAL_STREAM_KEY } from '@/lib/ai/stream-routing'

const ME = 'me'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function render(conv = 'c1') {
  return renderHook((p: { conv: string }) => useAiStreams(p.conv, ME), { initialProps: { conv } })
}

describe('useAiStreams', () => {
  it('my placeholder is adopted by the first event of my reply and accumulates chunks', () => {
    const { result } = render()
    act(() => result.current.startLocal())
    expect(result.current.streams.map((s) => s.key)).toEqual([LOCAL_STREAM_KEY])

    act(() => {
      result.current.handleEvent({ type: 'AI_STREAM_CHUNK', replyId: 'r1', requesterId: ME, chunk: 'Hel' })
      result.current.handleEvent({ type: 'AI_STREAM_CHUNK', replyId: 'r1', requesterId: ME, chunk: 'lo' })
    })
    expect(result.current.streams).toHaveLength(1)
    expect(result.current.streams[0]).toMatchObject({ replyId: 'r1', content: 'Hello', thinking: false })
  })

  it('two concurrent replies get their own bubbles; finishing one keeps the other', () => {
    const { result } = render()
    act(() => {
      result.current.handleEvent({ type: 'AI_STREAM_CHUNK', replyId: 'a', requesterId: 'bob', chunk: 'A' })
      result.current.handleEvent({ type: 'AI_STREAM_CHUNK', replyId: 'b', requesterId: 'amy', chunk: 'B' })
    })
    expect(result.current.streams.map((s) => s.content)).toEqual(['A', 'B'])
    act(() => result.current.finishReply('a'))
    expect(result.current.streams.map((s) => s.replyId)).toEqual(['b'])
    // Unknown reply → no-op.
    act(() => result.current.finishReply('zzz'))
    expect(result.current.streams).toHaveLength(1)
  })

  it('the error toast is only for the requester', () => {
    const { result } = render()
    let mine = false
    let theirs = true
    act(() => {
      result.current.handleEvent({ type: 'AI_STREAM_CHUNK', replyId: 'a', requesterId: 'bob', chunk: 'x' })
      theirs = result.current.handleEvent({ type: 'AI_STREAM_ERROR', replyId: 'a', requesterId: 'bob', code: 'AI_UNAVAILABLE' })
      mine = result.current.handleEvent({ type: 'AI_STREAM_ERROR', replyId: 'q', requesterId: ME, code: 'AI_UNAVAILABLE' })
    })
    expect(theirs).toBe(false)
    expect(mine).toBe(true)
    expect(result.current.streams).toEqual([])
  })

  it('a silent bubble is dropped after the watchdog; activity re-arms it', () => {
    const { result } = render()
    act(() => {
      result.current.handleEvent({ type: 'AI_STREAM_CHUNK', replyId: 'a', requesterId: 'bob', chunk: 'x' })
    })
    act(() => vi.advanceTimersByTime(AI_STREAM_WATCHDOG_MS - 1000))
    act(() => {
      result.current.handleEvent({ type: 'AI_STREAM_CHUNK', replyId: 'a', requesterId: 'bob', chunk: 'y' })
    })
    act(() => vi.advanceTimersByTime(AI_STREAM_WATCHDOG_MS - 1000))
    expect(result.current.streams).toHaveLength(1) // re-armed, still alive
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.streams).toEqual([])
  })

  it('the placeholder has its own watchdog; dropLocal removes it and its timer', () => {
    const { result } = render()
    act(() => result.current.startLocal())
    act(() => result.current.dropLocal())
    expect(result.current.streams).toEqual([])
    act(() => result.current.startLocal())
    act(() => vi.advanceTimersByTime(AI_STREAM_WATCHDOG_MS))
    expect(result.current.streams).toEqual([])
  })

  it('a DONE clears that bubble and its watchdog never fires on a later bubble', () => {
    const { result } = render()
    act(() => {
      result.current.handleEvent({ type: 'AI_STREAM_CHUNK', replyId: 'a', requesterId: 'bob', chunk: 'x' })
    })
    act(() => vi.advanceTimersByTime(AI_STREAM_WATCHDOG_MS - 10))
    act(() => {
      result.current.handleEvent({ type: 'AI_STREAM_DONE', replyId: 'a', requesterId: 'bob' })
      result.current.handleEvent({ type: 'AI_STREAM_CHUNK', replyId: 'b', requesterId: 'bob', chunk: 'z' })
    })
    act(() => vi.advanceTimersByTime(20))
    expect(result.current.streams.map((s) => s.replyId)).toEqual(['b'])
  })

  it('switching conversation clears bubbles and pending timers', () => {
    const { result, rerender } = render('c1')
    act(() => result.current.startLocal())
    rerender({ conv: 'c2' })
    expect(result.current.streams).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
})
