import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RateLimiterService } from './rate-limiter.service';

function makeConfig(over: Record<string, unknown> = {}): ConfigService {
  const map: Record<string, unknown> = {
    'config.rateLimit.enabled': true,
    'config.rateLimit.maxRequestsPerMin': 3,
    'config.rateLimit.maxConcurrent': 2,
    ...over,
  };
  return { get: jest.fn((k: string) => map[k]) } as unknown as ConfigService;
}

describe('RateLimiterService', () => {
  let incr: jest.Mock;
  let expire: jest.Mock;
  let decr: jest.Mock;
  let redis: Redis;

  beforeEach(() => {
    incr = jest.fn();
    expire = jest.fn().mockResolvedValue(1);
    decr = jest.fn().mockResolvedValue(0);
    redis = { incr, expire, decr } as unknown as Redis;
  });

  it('allows requests under the per-minute limit and returns a release fn', async () => {
    incr.mockResolvedValueOnce(1).mockResolvedValueOnce(1); // window=1, concurrency=1
    const svc = new RateLimiterService(redis, makeConfig());

    const decision = await svc.acquire('u1');

    expect(decision.allowed).toBe(true);
    await decision.release();
    expect(decr).toHaveBeenCalledTimes(1);
  });

  it('blocks with reason "rate" when the window count exceeds the cap', async () => {
    incr.mockResolvedValueOnce(4); // window count > 3
    const svc = new RateLimiterService(redis, makeConfig());

    const decision = await svc.acquire('u1');

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('rate');
    // concurrency must not be touched when the window rejects first
    expect(incr).toHaveBeenCalledTimes(1);
  });

  it('blocks with reason "concurrency" and rolls back the slot when too many in flight', async () => {
    incr.mockResolvedValueOnce(1).mockResolvedValueOnce(3); // window ok, concurrency 3 > 2
    const svc = new RateLimiterService(redis, makeConfig());

    const decision = await svc.acquire('u1');

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('concurrency');
    expect(decr).toHaveBeenCalledTimes(1); // rolled back the over-limit incr
  });

  it('release is idempotent (decrements at most once)', async () => {
    incr.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const svc = new RateLimiterService(redis, makeConfig());

    const decision = await svc.acquire('u1');
    await decision.release();
    await decision.release();

    expect(decr).toHaveBeenCalledTimes(1);
  });

  it('fails OPEN when Redis throws', async () => {
    incr.mockRejectedValue(new Error('redis down'));
    const svc = new RateLimiterService(redis, makeConfig());

    const decision = await svc.acquire('u1');

    expect(decision.allowed).toBe(true);
  });

  it('is a no-op pass-through when disabled', async () => {
    const svc = new RateLimiterService(redis, makeConfig({ 'config.rateLimit.enabled': false }));

    const decision = await svc.acquire('u1');

    expect(decision.allowed).toBe(true);
    expect(incr).not.toHaveBeenCalled();
  });
});
