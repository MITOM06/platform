import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OneShotTimer } from '../one-shot-timer'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('OneShotTimer', () => {
  it('fires once after its delay', () => {
    const timer = new OneShotTimer(1_000)
    const expire = vi.fn()
    timer.arm(expire)
    vi.advanceTimersByTime(999)
    expect(expire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(expire).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(5_000)
    expect(expire).toHaveBeenCalledOnce()
  })

  it('arming again replaces the pending one', () => {
    const timer = new OneShotTimer(1_000)
    const first = vi.fn()
    const second = vi.fn()
    timer.arm(first)
    vi.advanceTimersByTime(600)
    timer.arm(second)
    vi.advanceTimersByTime(600)
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(second).toHaveBeenCalledOnce()
  })

  it('clear cancels it; the callback may re-arm it', () => {
    const timer = new OneShotTimer(1_000)
    const expire = vi.fn()
    timer.arm(expire)
    timer.clear()
    vi.advanceTimersByTime(2_000)
    expect(expire).not.toHaveBeenCalled()

    const again = vi.fn()
    timer.arm(() => timer.arm(again))
    vi.advanceTimersByTime(2_000)
    expect(again).toHaveBeenCalledOnce()
  })
})
