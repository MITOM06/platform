import { Capability } from '@platform/database';
import { FakeRedis } from './fake-redis.spec-helper';
import { MfaChallengeService } from './mfa-challenge.service';
import { MfaPendingStore } from './mfa-pending.store';

describe('MfaChallengeService (mandatory for admins, opt-in for Members)', () => {
  let claims: { resolve: jest.Mock };
  let redis: FakeRedis;
  let pending: MfaPendingStore;
  let service: MfaChallengeService;
  const ctx = {
    deviceId: 'web-login',
    platform: 'web',
    method: 'password' as const,
  };
  const user = (enabled?: boolean, extra: Record<string, unknown> = {}) => ({
    _id: { toString: () => 'u1' },
    email: 'jane@acme.com',
    displayName: 'Jane',
    mfa: enabled === undefined ? undefined : { enabled },
    ...extra,
  });
  const asRole = (role: string, perms: string[] = []) =>
    claims.resolve.mockResolvedValue({ role, perms, depts: [] });

  beforeEach(() => {
    claims = { resolve: jest.fn() };
    asRole('Member', [Capability.USE_GROUP_BOT]);
    redis = new FakeRedis();
    pending = new MfaPendingStore(redis as never);
    service = new MfaChallengeService(claims as never, pending);
  });

  it.each([
    ['Owner', []],
    ['Admin', [Capability.MANAGE_MEMBERS]],
    ['Ops lead (custom, MANAGE_ROLES)', [Capability.MANAGE_ROLES]],
    [
      'Workspace admin (custom, MANAGE_WORKSPACE)',
      [Capability.MANAGE_WORKSPACE],
    ],
  ])(
    '%s, never enrolled → MFA_REQUIRED + enrollmentRequired, enroll-stage token',
    async (role, perms) => {
      asRole(role, perms);
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

  it('an enrolled admin → verify-stage token, enrollmentRequired false', async () => {
    asRole('Admin', [Capability.MANAGE_MEMBERS]);
    const res = await service.challengeIfRequired(user(true), ctx);
    expect(res?.enrollmentRequired).toBe(false);
    expect((await pending.get(res!.mfaToken))?.stage).toBe('verify');
  });

  it.each([
    ['never enrolled', undefined],
    ['turned 2FA off', false],
  ])('a Member who %s → null (tokens), no pending record', async (_l, en) => {
    expect(await service.challengeIfRequired(user(en), ctx)).toBeNull();
    expect(redis.keys()).toEqual([]);
  });

  it('a custom role without admin capabilities is treated like a Member', async () => {
    asRole('Manager', [Capability.RUN_SENSITIVE_SKILL]);
    expect(await service.challengeIfRequired(user(), ctx)).toBeNull();
  });

  it('a Member who turned 2FA on → verify (their choice is respected); no role lookup needed', async () => {
    const res = await service.challengeIfRequired(user(true), ctx);
    expect(res).toMatchObject({
      code: 'MFA_REQUIRED',
      enrollmentRequired: false,
    });
    expect((await pending.get(res!.mfaToken))?.stage).toBe('verify');
    expect(claims.resolve).not.toHaveBeenCalled();
  });

  it('the sign-in method is kept on the pending record (becomes the session method)', async () => {
    asRole('Owner');
    const res = await service.challengeIfRequired(user(), {
      deviceId: 'd',
      platform: 'mobile',
      method: 'invite',
    });
    expect((await pending.get(res!.mfaToken))?.method).toBe('invite');
  });

  it('a bot account → null, no pending record (even with an admin role)', async () => {
    asRole('Admin', [Capability.MANAGE_MEMBERS]);
    expect(
      await service.challengeIfRequired(user(true, { isBot: true }), ctx),
    ).toBeNull();
    expect(redis.keys()).toEqual([]);
  });
});
