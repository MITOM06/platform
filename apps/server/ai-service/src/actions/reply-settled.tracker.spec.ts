import { ReplySettledTracker } from './reply-settled.tracker';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RedisMock = require('ioredis-mock');

/**
 * A card can be confirmed while its reply is still streaming (slow free
 * models). The follow-up was posted at once: it landed above the reply holding
 * the card, and in the session before the request it answers.
 */
describe('ReplySettledTracker', () => {
  let redis: any;
  let tracker: ReplySettledTracker;

  beforeEach(() => {
    redis = new RedisMock();
    tracker = new ReplySettledTracker(redis);
  });
  afterEach(() => redis.flushall());

  it('returns at once for a reply that has already settled', async () => {
    await tracker.markSettled('reply-1');

    await expect(tracker.waitUntilSettled('reply-1', { timeoutMs: 1_000, pollMs: 10 })).resolves.toBe(true);
    expect(await redis.ttl('ai:reply-settled:reply-1')).toBeGreaterThan(0);
  });

  it('waits until the reply settles', async () => {
    setTimeout(() => void tracker.markSettled('reply-2'), 60);
    const started = Date.now();

    await expect(tracker.waitUntilSettled('reply-2', { timeoutMs: 2_000, pollMs: 10 })).resolves.toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });

  it('gives up after the timeout (a reply that never reported back)', async () => {
    await expect(tracker.waitUntilSettled('reply-3', { timeoutMs: 50, pollMs: 10 })).resolves.toBe(false);
  });

  it('a Redis failure does not block the follow-up', async () => {
    redis.get = jest.fn().mockRejectedValue(new Error('redis down'));

    await expect(tracker.waitUntilSettled('reply-4', { timeoutMs: 1_000, pollMs: 10 })).resolves.toBe(false);
  });
});
