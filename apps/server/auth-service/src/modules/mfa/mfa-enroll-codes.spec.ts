import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { FakeRedis } from './fake-redis.spec-helper';
import { createFakeUserModel, FakeUser } from './fake-user-model.spec-helper';
import { MfaChallengeService } from './mfa-challenge.service';
import { MfaCodeService } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';
import {
  MFA_CODES_PENDING_TTL_SECONDS,
  MfaPendingStore,
  MfaStage,
} from './mfa-pending.store';
import { MfaService } from './mfa.service';

const UID = '64b0000000000000000000a1';
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

/**
 * Backup codes are acknowledged before any session exists:
 * confirm (codes, no session) → codes (same codes, re-readable) → complete
 * (session, single use). No QR is rendered here (enroll/start is skipped by
 * planting the pending secret), so Jest fake timers are safe.
 */
describe('MfaService enroll/confirm → codes → complete', () => {
  let redis: FakeRedis;
  let pending: MfaPendingStore;
  let crypto: MfaCryptoService;
  let audit: { record: jest.Mock };
  let users: ReturnType<typeof createFakeUserModel>;
  let service: MfaService;

  const owner = (extra: Partial<FakeUser> = {}): FakeUser => ({
    _id: UID,
    email: 'owner@acme.com',
    displayName: 'Owner',
    status: 'active',
    ...extra,
  });
  const setup = (user: FakeUser = owner()) => {
    users = createFakeUserModel(user);
    service = new MfaService(
      users as never,
      pending,
      new MfaCodeService(redis as never),
      crypto,
      audit as never,
    );
  };
  const token = (stage: MfaStage) =>
    pending.create({
      userId: UID,
      stage,
      deviceId: 'web-login',
      platform: 'web',
    });
  /** An enroll-stage token as enroll/start leaves it. */
  const startedToken = async () => {
    const t = await token('enroll');
    const { key } = (await pending.get(t))!;
    await pending.setSecretIfAbsent(key, crypto.encrypt(SECRET, UID));
    return t;
  };
  const confirmed = async (device: Record<string, string> = {}) => {
    const t = await startedToken();
    const { backupCodes } = await service.enrollConfirm({
      mfaToken: t,
      code: authenticator.generate(SECRET),
      ...device,
    });
    return { t, backupCodes };
  };
  const rejects = (p: Promise<unknown>, status: number, code: string) =>
    expect(p).rejects.toMatchObject({ status, response: { code } });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-05T10:00:05Z') });
    redis = new FakeRedis();
    pending = new MfaPendingStore(redis as never);
    crypto = new MfaCryptoService({
      get: (k: string) => (k === 'SESSION_SECRET' ? 's'.repeat(64) : undefined),
    } as unknown as ConfigService);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    setup();
  });
  afterEach(() => jest.useRealTimers());

  it('confirm enrolls and leaves a codes_pending record: secret dropped, codes encrypted, TTL 10 min', async () => {
    const { t, backupCodes } = await confirmed();
    expect(backupCodes).toHaveLength(10);
    expect(users.users.get(UID)!.mfa!.enabled).toBe(true);

    const p = (await pending.get(t))!;
    expect(p.stage).toBe('codes_pending');
    expect(p.secretEnc).toBeUndefined();
    expect(p.enrolledAt).toBe(users.users.get(UID)!.mfa!.enrolledAt!.getTime());
    expect(await redis.ttl(p.key)).toBe(MFA_CODES_PENDING_TTL_SECONDS);
    // Redis never holds a live backup code in clear text.
    const raw = JSON.stringify(await redis.hgetall(p.key));
    for (const c of backupCodes) expect(raw).not.toContain(c);
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mfa.enrolled' }),
    );
  });

  it('codes returns the same codes on every call until complete; complete is single use', async () => {
    const { t, backupCodes } = await confirmed();
    await expect(service.enrollCodes(t)).resolves.toEqual({ backupCodes });
    await expect(service.enrollCodes(t)).resolves.toEqual({ backupCodes });

    const done = await service.enrollComplete({ mfaToken: t });
    expect(done.user.email).toBe('owner@acme.com');
    expect(done).toMatchObject({ deviceId: 'web-login', platform: 'web' });
    expect(redis.keys('mfa:pending:')).toEqual([]);

    await rejects(
      service.enrollComplete({ mfaToken: t }),
      401,
      'MFA_TOKEN_INVALID',
    );
    await rejects(service.enrollCodes(t), 401, 'MFA_TOKEN_INVALID');
    // complete audits nothing new.
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('session fields: the sign-in values, else those sent at confirm, else those sent at complete', async () => {
    const a = await confirmed({ deviceId: 'dev-9', platform: 'mobile' });
    await expect(
      service.enrollComplete({ mfaToken: a.t }),
    ).resolves.toMatchObject({ deviceId: 'dev-9', platform: 'mobile' });

    users.users.get(UID)!.mfa = undefined;
    jest.advanceTimersByTime(30_000); // next TOTP step (replay guard)
    const b = await confirmed({ deviceId: 'dev-9', platform: 'mobile' });
    await expect(
      service.enrollComplete({
        mfaToken: b.t,
        deviceId: 'phone-1',
        platform: 'android',
      }),
    ).resolves.toMatchObject({ deviceId: 'phone-1', platform: 'android' });
  });

  it('codes / complete before confirm, or with a verify token → 400 MFA_NOT_ENROLLED', async () => {
    for (const t of [
      await token('enroll'),
      await startedToken(),
      await token('verify'),
    ]) {
      await rejects(service.enrollCodes(t), 400, 'MFA_NOT_ENROLLED');
      await rejects(
        service.enrollComplete({ mfaToken: t }),
        400,
        'MFA_NOT_ENROLLED',
      );
    }
    for (const t of ['nope', undefined, '']) {
      await rejects(service.enrollCodes(t), 401, 'MFA_TOKEN_INVALID');
      await rejects(
        service.enrollComplete({ mfaToken: t }),
        401,
        'MFA_TOKEN_INVALID',
      );
    }
  });

  it('the codes step cannot be skipped: start / confirm / verify refuse a codes_pending token', async () => {
    const { t } = await confirmed();
    jest.advanceTimersByTime(30_000); // a fresh TOTP step
    const code = authenticator.generate(SECRET);
    await rejects(service.enrollStart(t), 400, 'MFA_ALREADY_ENROLLED');
    await rejects(
      service.enrollConfirm({ mfaToken: t, code }),
      400,
      'MFA_ALREADY_ENROLLED',
    );
    await rejects(
      service.verify({ mfaToken: t, code }),
      400,
      'MFA_NOT_ENROLLED',
    );
    // The record is intact: the user can still finish.
    await expect(service.enrollComplete({ mfaToken: t })).resolves.toBeTruthy();
  });

  it('TTL: the codes step lives 10 minutes from confirm (not from sign-in)', async () => {
    const t = await startedToken();
    jest.advanceTimersByTime(4 * 60_000);
    await service.enrollConfirm({
      mfaToken: t,
      code: authenticator.generate(SECRET),
    });
    jest.advanceTimersByTime(MFA_CODES_PENDING_TTL_SECONDS * 1000 - 1);
    await expect(service.enrollCodes(t)).resolves.toBeTruthy();
    jest.advanceTimersByTime(1);
    await rejects(service.enrollCodes(t), 401, 'MFA_TOKEN_INVALID');
    await rejects(
      service.enrollComplete({ mfaToken: t }),
      401,
      'MFA_TOKEN_INVALID',
    );
  });

  it.each([
    ['2FA reset by an Owner', () => undefined],
    [
      'reset and re-enrolled elsewhere',
      () => ({ enabled: true, enrolledAt: new Date(Date.now() + 1000) }),
    ],
  ])(
    '%s after confirm → MFA_TOKEN_INVALID, record burned, no session',
    async (_label, mfa) => {
      const { t } = await confirmed();
      users.users.get(UID)!.mfa = mfa();
      await rejects(
        service.enrollComplete({ mfaToken: t }),
        401,
        'MFA_TOKEN_INVALID',
      );
      expect(redis.keys('mfa:pending:')).toEqual([]);
    },
  );

  it('blocked after confirm → 403 ACCOUNT_BLOCKED and the record is burned', async () => {
    const { t } = await confirmed();
    users.users.get(UID)!.status = 'blocked';
    await rejects(service.enrollCodes(t), 403, 'ACCOUNT_BLOCKED');
    expect(redis.keys('mfa:pending:')).toEqual([]);
  });

  it('abandoned at the codes step: the account is enrolled, next sign-in is verify mode', async () => {
    const { backupCodes } = await confirmed();
    jest.advanceTimersByTime(MFA_CODES_PENDING_TTL_SECONDS * 1000);
    expect(redis.keys('mfa:pending:')).toEqual([]);

    const challenge = new MfaChallengeService(
      {
        resolve: jest
          .fn()
          .mockResolvedValue({ role: 'Owner', perms: [], depts: [] }),
      } as never,
      pending,
    );
    const user = await users.findById(UID).exec();
    const res = await challenge.challengeIfRequired(user!, {
      deviceId: 'web-login',
      platform: 'web',
    });
    expect(res).toMatchObject({
      code: 'MFA_REQUIRED',
      enrollmentRequired: false,
    });
    // The codes issued at confirm are live.
    await expect(
      service.verify({ mfaToken: res!.mfaToken, backupCode: backupCodes[0] }),
    ).resolves.toMatchObject({ backupCodesRemaining: 9 });
  });
});
