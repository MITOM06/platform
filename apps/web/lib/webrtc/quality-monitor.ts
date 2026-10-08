import { receiveQuality, type ReceiveQuality, type ReceiveSample } from './call-network'

/**
 * Peer-to-peer only: samples how well we receive the other person's audio
 * (`inbound-rtp`) and reports changes, which are sent to them in `call.state`
 * so each side can tell whose network is weak (see `attributeQuality`).
 */
export class QualityMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private prev: ReceiveSample | null = null
  /** Null until the first sample: that one is always reported, so the peer hears "good" too. */
  private last: ReceiveQuality | null = null

  constructor(
    private readonly onChange: (quality: ReceiveQuality) => void,
    private readonly everyMs = 3_000,
  ) {}

  start(pc: RTCPeerConnection): void {
    this.stop()
    this.timer = setInterval(() => void this.sample(pc), this.everyMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.prev = null
    this.last = null // a restart (reconnect) reports afresh, clearing a stale "poor"
  }

  private async sample(pc: RTCPeerConnection): Promise<void> {
    let cur: ReceiveSample | null = null
    try {
      const stats = await pc.getStats()
      stats.forEach((r: { type?: string; kind?: string; packetsReceived?: number; packetsLost?: number; jitter?: number }) => {
        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
          cur = { packetsReceived: r.packetsReceived ?? 0, packetsLost: r.packetsLost ?? 0, jitter: r.jitter ?? 0 }
        }
      })
    } catch {
      return // the connection closed between ticks
    }
    if (!cur || !this.timer) return
    const quality = receiveQuality(this.prev, cur)
    this.prev = cur
    if (quality !== this.last) {
      this.last = quality
      this.onChange(quality)
    }
  }
}
