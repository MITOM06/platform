/**
 * Minimal in-memory Redis for MFA unit tests: the string / hash / TTL / MULTI
 * subset the MFA services use, with expiry driven by Date.now() (so Jest fake
 * timers can expire keys). Test-only: excluded from the build.
 */
type Value = string | Map<string, string>;

export class FakeRedis {
  private readonly data = new Map<
    string,
    { value: Value; expiresAt?: number }
  >();

  private entry(key: string) {
    const e = this.data.get(key);
    if (e?.expiresAt !== undefined && Date.now() >= e.expiresAt) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  private hash(key: string, create: boolean): Map<string, string> | undefined {
    const e = this.entry(key);
    if (e) return e.value as Map<string, string>;
    if (!create) return undefined;
    const value = new Map<string, string>();
    this.data.set(key, { value });
    return value;
  }

  /** Test inspection: every live key. */
  keys(prefix = ''): string[] {
    return [...this.data.keys()].filter(
      (k) => k.startsWith(prefix) && this.entry(k),
    );
  }

  async get(key: string) {
    return (this.entry(key)?.value as string | undefined) ?? null;
  }

  async set(key: string, value: string, ...args: (string | number)[]) {
    const nx = args.includes('NX');
    if (nx && this.entry(key)) return null;
    const exIdx = args.indexOf('EX');
    const expiresAt =
      exIdx >= 0 ? Date.now() + Number(args[exIdx + 1]) * 1000 : undefined;
    this.data.set(key, { value, expiresAt });
    return 'OK';
  }

  async getdel(key: string) {
    const v = await this.get(key);
    this.data.delete(key);
    return v;
  }

  async incr(key: string) {
    const e = this.entry(key);
    const next = Number(e?.value ?? 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: e?.expiresAt });
    return next;
  }

  async expire(key: string, seconds: number) {
    const e = this.entry(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string) {
    const e = this.entry(key);
    if (!e) return -2;
    if (e.expiresAt === undefined) return -1;
    return Math.ceil((e.expiresAt - Date.now()) / 1000);
  }

  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys) if (this.entry(k) && this.data.delete(k)) n++;
    return n;
  }

  async hset(key: string, fields: Record<string, string>) {
    const h = this.hash(key, true)!;
    for (const [f, v] of Object.entries(fields)) h.set(f, String(v));
    return Object.keys(fields).length;
  }

  async hsetnx(key: string, field: string, value: string) {
    const h = this.hash(key, true)!;
    if (h.has(field)) return 0;
    h.set(field, value);
    return 1;
  }

  async hget(key: string, field: string) {
    return this.hash(key, false)?.get(field) ?? null;
  }

  async hgetall(key: string) {
    return Object.fromEntries(this.hash(key, false) ?? new Map());
  }

  async hincrby(key: string, field: string, by: number) {
    const h = this.hash(key, true)!;
    const next = Number(h.get(field) ?? 0) + by;
    h.set(field, String(next));
    return next;
  }

  multi() {
    const queue: Array<() => Promise<unknown>> = [];
    const chain: Record<string, unknown> = {
      exec: async () => {
        const out: Array<[null, unknown]> = [];
        for (const op of queue) out.push([null, await op()]);
        return out;
      },
    };
    for (const name of [
      'hset',
      'hsetnx',
      'hget',
      'hincrby',
      'expire',
      'ttl',
      'del',
      'set',
      'get',
    ]) {
      chain[name] = (...args: unknown[]) => {
        queue.push(() => (this as any)[name](...args));
        return chain;
      };
    }
    return chain;
  }
}
