import { createHash } from 'node:crypto';
import { FakeRedis } from './fake-redis.spec-helper';
import {
  MFA_CODES_PENDING_TTL_SECONDS,
  MFA_TOKEN_TTL_SECONDS,
  MfaPendingStore,
} from './mfa-pending.store';

describe('MfaPendingStore (mfa:pending:<sha256>)', () => {
  let redis: FakeRedis;
  let store: MfaPendingStore;
  const ctx = {
    userId: 'u1',
    stage: 'verify' as const,
    deviceId: 'd1',
    platform: 'web',
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-03T10:00:00Z') });
    redis = new FakeRedis();
    store = new MfaPendingStore(redis as never);
  });
  afterEach(() => jest.useRealTimers());

  it('opaque 32-byte token; Redis keys it by sha256, never by the token', async () => {
    const token = await store.create(ctx);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    const key = `mfa:pending:${createHash('sha256').update(token).digest('hex')}`;
    expect(redis.keys('mfa:pending:')).toEqual([key]);
    expect(await redis.ttl(key)).toBe(MFA_TOKEN_TTL_SECONDS);
    expect(await store.get(token)).toEqual({
      key,
      ...ctx,
      attempts: 0,
      secretEnc: undefined,
    });
  });

  it('TTL: the token is gone after 5 minutes', async () => {
    const token = await store.create(ctx);
    jest.advanceTimersByTime(MFA_TOKEN_TTL_SECONDS * 1000 - 1);
    expect(await store.get(token)).not.toBeNull();
    jest.advanceTimersByTime(1);
    expect(await store.get(token)).toBeNull();
  });

  it('single use: consume succeeds exactly once', async () => {
    const token = await store.create(ctx);
    const p = (await store.get(token))!;
    expect(await store.consume(p.key)).toBe(true);
    expect(await store.consume(p.key)).toBe(false);
    expect(await store.get(token)).toBeNull();
  });

  it('rejects junk tokens without touching Redis', async () => {
    expect(await store.get(undefined)).toBeNull();
    expect(await store.get('')).toBeNull();
    expect(await store.get(123)).toBeNull();
    expect(await store.get('x'.repeat(300))).toBeNull();
    expect(await store.get('unknown-token')).toBeNull();
  });

  it('counts failures and keeps the TTL', async () => {
    const token = await store.create(ctx);
    const { key } = (await store.get(token))!;
    jest.advanceTimersByTime(60_000);
    expect(await store.recordFailure(key)).toBe(1);
    expect(await store.recordFailure(key)).toBe(2);
    expect(await redis.ttl(key)).toBe(MFA_TOKEN_TTL_SECONDS - 60);
    expect((await store.get(token))!.attempts).toBe(2);
  });

  it('pending secret: first write wins, later calls return the same one', async () => {
    const token = await store.create({ ...ctx, stage: 'enroll' });
    const { key } = (await store.get(token))!;
    expect(await store.setSecretIfAbsent(key, 'enc-1')).toBe('enc-1');
    expect(await store.setSecretIfAbsent(key, 'enc-2')).toBe('enc-1');
    expect((await store.get(token))!.secretEnc).toBe('enc-1');
  });

  it('codes_pending: replaces the enroll record under the same token, 10-minute TTL', async () => {
    const token = await store.create({ ...ctx, stage: 'enroll' });
    const { key } = (await store.get(token))!;
    await store.setSecretIfAbsent(key, 'enc-secret');
    jest.advanceTimersByTime(4 * 60_000);
    expect(await store.consume(key)).toBe(true);
    await store.openCodesPending(key, {
      userId: 'u1',
      deviceId: 'd2',
      platform: 'mobile',
      backupCodesEnc: 'enc-codes',
      enrolledAt: 1_700_000_000_000,
    });
    expect(await store.get(token)).toEqual({
      key,
      userId: 'u1',
      stage: 'codes_pending',
      deviceId: 'd2',
      platform: 'mobile',
      attempts: 0,
      secretEnc: undefined,
      backupCodesEnc: 'enc-codes',
      enrolledAt: 1_700_000_000_000,
    });
    expect(await redis.ttl(key)).toBe(MFA_CODES_PENDING_TTL_SECONDS);
    jest.advanceTimersByTime(MFA_CODES_PENDING_TTL_SECONDS * 1000);
    expect(await store.get(token)).toBeNull();
  });

  it('a write after expiry does not resurrect a TTL-less record', async () => {
    const token = await store.create(ctx);
    const { key } = (await store.get(token))!;
    jest.advanceTimersByTime(MFA_TOKEN_TTL_SECONDS * 1000);
    expect(await store.recordFailure(key)).toBeNull();
    expect(await store.setSecretIfAbsent(key, 'enc')).toBeNull();
    expect(redis.keys('mfa:pending:')).toEqual([]);
  });
});
