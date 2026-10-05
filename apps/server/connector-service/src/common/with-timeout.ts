export class TimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`);
    this.name = 'TimeoutError';
  }
}

/**
 * Race `promise` against a timer. The underlying work is NOT cancelled (callers
 * that can abort should also pass an AbortSignal); this only bounds how long the
 * caller waits. A non-positive `ms` disables the timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  if (!(ms > 0)) return promise;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Parse a positive integer env value, falling back when unset/invalid. */
export function envInt(raw: string | undefined, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}
