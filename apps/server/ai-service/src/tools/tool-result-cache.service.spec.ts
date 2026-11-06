import { ToolResultCacheService, ToolCacheScope } from './tool-result-cache.service';

function make(config: Record<string, unknown> = {}, redisOver: Partial<Record<'get' | 'set', jest.Mock>> = {}) {
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    ...redisOver,
  };
  const svc = new ToolResultCacheService(
    redis as never,
    { get: jest.fn((k: string) => config[k]) } as never,
  );
  return { svc, redis };
}

const scope: ToolCacheScope = { userId: 'u1', conversationId: 'c1' };

describe('ToolResultCacheService', () => {
  describe('key — a cached result never crosses a user, conversation or KB scope', () => {
    const { svc } = make();
    const base = svc.key(scope, 'search_messages', { q: 'x' });

    it('is namespaced by user and tool', () => {
      expect(base).toMatch(/^ai:toolcache:u1:search_messages:[0-9a-f]{24}$/);
    });

    it('differs per user', () => {
      expect(svc.key({ ...scope, userId: 'u2' }, 'search_messages', { q: 'x' })).not.toBe(base);
    });

    it('differs per conversation for the same user and input', () => {
      expect(svc.key({ ...scope, conversationId: 'c2' }, 'search_messages', { q: 'x' })).not.toBe(base);
    });

    it('differs per department scope', () => {
      expect(svc.key({ ...scope, departmentId: 'd1' }, 'search_messages', { q: 'x' })).not.toBe(base);
    });

    it('differs per input and is stable for equal input', () => {
      expect(svc.key(scope, 'search_messages', { q: 'y' })).not.toBe(base);
      expect(svc.key(scope, 'search_messages', { q: 'x' })).toBe(base);
    });
  });

  it('reads and writes under the scoped key with the configured TTL', async () => {
    const { svc, redis } = make({ 'config.cache.toolCacheTtlSec': 30 });
    redis.get.mockResolvedValue('cached');
    const key = svc.key(scope, 't', { a: 1 });

    await expect(svc.get(scope, 't', { a: 1 })).resolves.toBe('cached');
    await svc.set(scope, 't', { a: 1 }, 'result');

    expect(redis.get).toHaveBeenCalledWith(key);
    expect(redis.set).toHaveBeenCalledWith(key, 'result', 'EX', 30);
  });

  it('defaults to a 60 s TTL', async () => {
    const { svc, redis } = make();
    await svc.set(scope, 't', {}, 'r');
    expect(redis.set.mock.calls[0][3]).toBe(60);
  });

  it.each([
    ['disabled by config', { 'config.cache.toolCacheEnabled': false }],
    ['TTL 0', { 'config.cache.toolCacheTtlSec': 0 }],
  ])('is a no-op when %s', async (_label, config) => {
    const { svc, redis } = make(config);
    expect(svc.isEnabled).toBe(false);
    await expect(svc.get(scope, 't', {})).resolves.toBeNull();
    await svc.set(scope, 't', {}, 'r');
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('fails open: a Redis error on get is a cache miss, on set is swallowed', async () => {
    const { svc } = make(
      {},
      {
        get: jest.fn().mockRejectedValue(new Error('redis down')),
        set: jest.fn().mockRejectedValue(new Error('redis down')),
      },
    );
    await expect(svc.get(scope, 't', {})).resolves.toBeNull();
    await expect(svc.set(scope, 't', {}, 'r')).resolves.toBeUndefined();
  });
});
