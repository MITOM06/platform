import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ResponseCacheService, cosine } from './response-cache.service';

function makeConfig(over: Record<string, unknown> = {}): ConfigService {
  const map: Record<string, unknown> = {
    'config.cache.responseCacheEnabled': true,
    'config.cache.responseCacheThreshold': 0.97,
    'config.cache.responseCacheTtlSec': 600,
    'config.cache.responseCacheMax': 20,
    ...over,
  };
  return { get: jest.fn((k: string) => map[k]) } as unknown as ConfigService;
}

/** Minimal in-memory Redis stub supporting get/set used by the service. */
function makeRedis(): Redis {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
  } as unknown as Redis;
}

describe('cosine', () => {
  it('is 1 for identical vectors and ~0 for orthogonal', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('handles empty / mismatched safely', () => {
    expect(cosine([], [1])).toBe(0);
    expect(cosine([1, 2], [1])).toBe(0);
  });
});

describe('ResponseCacheService', () => {
  it('is disabled by default (returns null, no store)', async () => {
    const svc = new ResponseCacheService(makeRedis(), makeConfig({ 'config.cache.responseCacheEnabled': false }));
    expect(svc.isEnabled).toBe(false);
    await svc.store('c1', [1, 0], 'answer');
    expect(await svc.lookup('c1', [1, 0])).toBeNull();
  });

  it('returns a stored answer for a near-identical query above threshold', async () => {
    const svc = new ResponseCacheService(makeRedis(), makeConfig());
    await svc.store('c1', [1, 0, 0], 'the answer');
    // Almost identical direction → cosine ≈ 1 ≥ 0.97.
    expect(await svc.lookup('c1', [0.999, 0.01, 0])).toBe('the answer');
  });

  it('does NOT return for a dissimilar query below threshold', async () => {
    const svc = new ResponseCacheService(makeRedis(), makeConfig());
    await svc.store('c1', [1, 0, 0], 'the answer');
    expect(await svc.lookup('c1', [0, 1, 0])).toBeNull();
  });

  it('scopes by conversation', async () => {
    const svc = new ResponseCacheService(makeRedis(), makeConfig());
    await svc.store('c1', [1, 0], 'a1');
    expect(await svc.lookup('c2', [1, 0])).toBeNull();
  });

  it('treats entries past the TTL as misses', async () => {
    const svc = new ResponseCacheService(makeRedis(), makeConfig({ 'config.cache.responseCacheTtlSec': 0 }));
    await svc.store('c1', [1, 0], 'a1');
    expect(await svc.lookup('c1', [1, 0])).toBeNull();
  });
});
