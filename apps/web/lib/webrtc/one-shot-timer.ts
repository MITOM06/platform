/** A one-shot timer with a fixed delay: arming it again replaces the pending one. */
export class OneShotTimer {
  private handle: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly ms: number) {}

  arm(onExpire: () => void): void {
    this.clear()
    this.handle = setTimeout(() => {
      this.handle = null
      onExpire()
    }, this.ms)
  }

  clear(): void {
    if (this.handle) clearTimeout(this.handle)
    this.handle = null
  }
}
