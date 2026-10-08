import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReconnectWatch } from '../reconnect-watch'
import { RECONNECT_GRACE_MS } from '../call-config'
import { useCallStore } from '@/lib/store/call.store'

beforeEach(() => {
  vi.useFakeTimers()
  useCallStore.getState().reset()
})
afterEach(() => vi.useRealTimers())

describe('ReconnectWatch', () => {
  it('waits a minute, showing whose connection it waits for, then gives up', () => {
    const watch = new ReconnectWatch()
    const expire = vi.fn()
    watch.begin('peer', expire)
    expect(RECONNECT_GRACE_MS).toBe(60_000)
    expect(useCallStore.getState().reconnectWait).toBe('peer')
    expect(useCallStore.getState().reconnectDeadline).toBe(Date.now() + 60_000)

    vi.advanceTimersByTime(59_999)
    expect(expire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(expire).toHaveBeenCalledOnce()
    expect(useCallStore.getState().reconnectWait).toBeNull()
  })

  it('stops when the connection comes back', () => {
    const watch = new ReconnectWatch()
    const expire = vi.fn()
    watch.begin('self', expire)
    vi.advanceTimersByTime(10_000)
    watch.end()
    vi.advanceTimersByTime(60_000)
    expect(expire).not.toHaveBeenCalled()
    expect(useCallStore.getState().reconnectWait).toBeNull()
    expect(watch.active).toBe(false)
  })

  it('retries recovery right away and every few seconds', () => {
    const watch = new ReconnectWatch()
    const tick = vi.fn()
    watch.begin('self', vi.fn(), tick, 4_000)
    expect(tick).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(8_000)
    expect(tick).toHaveBeenCalledTimes(3)
    watch.end()
    vi.advanceTimersByTime(8_000)
    expect(tick).toHaveBeenCalledTimes(3)
  })

  it('a second drop keeps the deadline but updates whose connection it is', () => {
    const watch = new ReconnectWatch()
    watch.begin('peer', vi.fn())
    const deadline = useCallStore.getState().reconnectDeadline
    vi.advanceTimersByTime(5_000)
    watch.begin('self', vi.fn())
    expect(useCallStore.getState().reconnectWait).toBe('self')
    expect(useCallStore.getState().reconnectDeadline).toBe(deadline)
  })
})
