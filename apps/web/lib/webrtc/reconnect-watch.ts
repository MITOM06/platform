import { useCallStore } from '@/lib/store/call.store'
import { RECONNECT_BLIP_MS, RECONNECT_GRACE_MS } from './call-config'

export type ReconnectWho = 'self' | 'peer'

/**
 * The "waiting to reconnect" window of a 1-on-1 (both media paths). It drives
 * the call screen's overlay and countdown through the store, retries recovery
 * on a beat, and ends the call when the minute runs out.
 */
export class ReconnectWatch {
  private expiry: ReturnType<typeof setTimeout> | null = null
  private ticker: ReturnType<typeof setInterval> | null = null
  private blip: ReturnType<typeof setTimeout> | null = null

  get active(): boolean {
    return this.expiry !== null
  }

  /** Open the window (or, while open, just update whose connection it waits for). */
  begin(who: ReconnectWho, onExpire: () => void, tick?: () => void, tickMs = 4_000): void {
    this.clearBlip()
    const store = useCallStore.getState()
    if (this.expiry) {
      store.setReconnectWait(who, store.reconnectDeadline)
      if (tick && !this.ticker) this.startTicker(tick, tickMs) // e.g. LiveKit gave up resuming
      return
    }
    store.setReconnectWait(who, Date.now() + RECONNECT_GRACE_MS)
    this.expiry = setTimeout(() => {
      this.end()
      onExpire()
    }, RECONNECT_GRACE_MS)
    if (tick) this.startTicker(tick, tickMs)
  }

  /**
   * Open the window only if the drop outlasts a blip (`RECONNECT_BLIP_MS`):
   * `end()` meanwhile — the connection came back — and nothing is shown.
   */
  beginAfterBlip(who: ReconnectWho, onExpire: () => void, tick?: () => void, tickMs = 4_000): void {
    if (this.expiry || this.blip) return
    this.blip = setTimeout(() => {
      this.blip = null
      this.begin(who, onExpire, tick, tickMs)
    }, RECONNECT_BLIP_MS)
  }

  private clearBlip(): void {
    if (this.blip) clearTimeout(this.blip)
    this.blip = null
  }

  private startTicker(tick: () => void, tickMs: number): void {
    tick()
    this.ticker = setInterval(tick, tickMs)
  }

  end(): void {
    this.clearBlip()
    if (this.expiry) clearTimeout(this.expiry)
    if (this.ticker) clearInterval(this.ticker)
    this.expiry = null
    this.ticker = null
    if (useCallStore.getState().reconnectWait) useCallStore.getState().setReconnectWait(null, null)
  }
}
