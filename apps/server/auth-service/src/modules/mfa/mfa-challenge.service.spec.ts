import { Capability } from '@platform/database';
import { FakeRedis } from './fake-redis.spec-helper';
import { MfaChallengeService } from './mfa-challenge.service';
import { MfaPendingStore } from './mfa-pending.store';

describe('MfaChallengeService (who gets the 2FA step)', () => {
  let claims: { resolve: jest.Mock };
  let redis: FakeRedis;
  let pending: MfaPendingStore;
  let service: MfaChallengeService;
  const ctx = { deviceId: 'web-login', platform: 'web' };
  const user = (enabled?: boolean) => ({
    _id: { toString: () => 'u1' },
    email: 'jane@acme.com',
    displayName: 'Jane',
    mfa: enabled === undefined ? undefined : { enabled },
  });

  beforeEach(() => {
    claims = { resolve: jest.fn() };
    redis = new FakeRedis();
    pending = new MfaPendingStore(redis as never);
    service = new MfaChallengeService(claims as never, pending);
  });

  it.each([
    ['Owner', []],
    ['Admin', [Capability.MANAGE_MEMBERS]],
    ['Ops lead (custom)', [Capability.MANAGE_MEMBERS]],
  ])(
    '%s, not enrolled → MFA_REQUIRED + enrollmentRequired, enroll-stage token',
    async (role, perms) => {
      claims.resolve.mockResolvedValue({ role, perms, depts: [] });
      const res = await service.challengeIfRequired(user(), ctx);
      expect(claims.resolve).toHaveBeenCalledWith('u1');
      expect(res).toEqual({
        code: 'MFA_REQUIRED',
        mfaToken: expect.any(String),
        enrollmentRequired: true,
        user: { id: 'u1', email: 'jane@acme.com', displayName: 'Jane' },
      });
      expect(await pending.get(res!.mfaToken)).toMatchObject({
        userId: 'u1',
        stage: 'enroll',
        ...ctx,
      });
    },
  );

  it('enrolled privileged user → verify-stage token, enrollmentRequired false', async () => {
    claims.resolve.mockResolvedValue({ role: 'Admin', perms: [], depts: [] });
    const res = await service.challengeIfRequired(user(true), ctx);
    expect(res?.enrollmentRequired).toBe(false);
    expect((await pending.get(res!.mfaToken))?.stage).toBe('verify');
  });

  it('Member (even with leftover enrollment) → null, no pending record', async () => {
    claims.resolve.mockResolvedValue({
      role: 'Member',
      perms: [Capability.USE_GROUP_BOT],
      depts: [],
    });
    expect(await service.challengeIfRequired(user(true), ctx)).toBeNull();
    expect(redis.keys()).toEqual([]);
  });
});
