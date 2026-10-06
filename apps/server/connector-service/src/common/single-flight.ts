/**
 * Collapses concurrent calls for the same key into one in-flight promise.
 *
 * Used for OAuth refreshes: providers that ROTATE refresh tokens (most MCP
 * authorization servers) invalidate the old one on first use, so two parallel
 * tool calls refreshing the same connection would make the second one fail
 * with `invalid_grant` — and reuse detection can revoke the whole grant. One
 * flight per connection prevents that within this process.
 */
export class SingleFlight<T> {
  private readonly inflight = new Map<string, Promise<T>>();

  run(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    // Defer `fn` by a microtask so the entry is registered before it can settle.
    const flight = Promise.resolve().then(fn);
    this.inflight.set(key, flight);
    const clear = () => {
      if (this.inflight.get(key) === flight) this.inflight.delete(key);
    };
    flight.then(clear, clear);
    return flight;
  }

  /** Number of in-flight keys (diagnostics/tests). */
  get size(): number {
    return this.inflight.size;
  }
}
