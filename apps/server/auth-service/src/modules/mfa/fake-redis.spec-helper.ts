/**
 * Minimal in-memory Redis for MFA / session unit tests: the string / hash /
 * set / TTL / MULTI / pipeline subset those services use, with expiry driven by
 * Date.now() (so Jest fake timers can expire keys). PUBLISH is recorded in
 * `published`. Test-only: excluded from the build.
 */
type Value = string | Map<string, string> | Set<string>;

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

  /** Every PUBLISH, in order. */
  readonly published: Array<{ channel: string; message: string }> = [];

  private set_(key: string, create: boolean): Set<string> | undefined {
    const e = this.entry(key);
    if (e) return e.value as Set<string>;
    if (!create) return undefined;
    const value = new Set<string>();
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

  async hmget(key: string, ...fields: string[]) {
    const h = this.hash(key, false);
    return fields.map((f) => h?.get(f) ?? null);
  }

  async sadd(key: string, ...members: string[]) {
    const s = this.set_(key, true)!;
    const before = s.size;
    for (const m of members) s.add(m);
    return s.size - before;
  }

  async srem(key: string, ...members: string[]) {
    const s = this.set_(key, false);
    if (!s) return 0;
    let n = 0;
    for (const m of members) if (s.delete(m)) n++;
    return n;
  }

  async smembers(key: string) {
    return [...(this.set_(key, false) ?? [])];
  }

  async publish(channel: string, message: string) {
    this.published.push({ channel, message });
    return 1;
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
      'hmget',
      'hgetall',
      'sadd',
      'srem',
    ]) {
      chain[name] = (...args: unknown[]) => {
        queue.push(() => (this as any)[name](...args));
        return chain;
      };
    }
    return chain;
  }

  /** Same queued semantics as MULTI (no atomicity needed in tests). */
  pipeline() {
    return this.multi();
  }
}
