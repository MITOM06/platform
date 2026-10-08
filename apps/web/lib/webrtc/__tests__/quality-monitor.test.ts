import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QualityMonitor } from '../quality-monitor'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

/** A peer connection whose audio inbound-rtp counters follow `samples`. */
function fakePc(samples: Array<{ packetsReceived: number; packetsLost: number; jitter?: number }>) {
  let i = 0
  return {
    getStats: vi.fn(async () => {
      const s = samples[Math.min(i++, samples.length - 1)]
      return new Map([['in', { type: 'inbound-rtp', kind: 'audio', jitter: 0.01, ...s }]])
    }),
  } as unknown as RTCPeerConnection
}

describe('QualityMonitor', () => {
  it('reports only when the receive quality changes', async () => {
    const onChange = vi.fn()
    const monitor = new QualityMonitor(onChange, 3_000)
    monitor.start(
      fakePc([
        { packetsReceived: 0, packetsLost: 0 },
        { packetsReceived: 150, packetsLost: 0 }, // good
        { packetsReceived: 250, packetsLost: 20 }, // 20/120 lost → poor
        { packetsReceived: 400, packetsLost: 22 }, // 2/152 → good
        { packetsReceived: 550, packetsLost: 22 }, // still good
      ]),
    )
    await vi.advanceTimersByTimeAsync(3_000 * 5)
    expect(onChange.mock.calls.map(([q]) => q)).toEqual(['poor', 'good'])
    monitor.stop()
  })

  it('stops sampling when stopped', async () => {
    const pc = fakePc([{ packetsReceived: 0, packetsLost: 0 }])
    const monitor = new QualityMonitor(vi.fn(), 3_000)
    monitor.start(pc)
    monitor.stop()
    await vi.advanceTimersByTimeAsync(9_000)
    expect(pc.getStats).not.toHaveBeenCalled()
  })
})
