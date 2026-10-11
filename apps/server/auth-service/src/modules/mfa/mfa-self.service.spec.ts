jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { FakeRedis } from './fake-redis.spec-helper';
import { createFakeUserModel, FakeUser } from './fake-user-model.spec-helper';
import { hashBackupCode, MfaCodeService } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';
import {
  MFA_SELF_PENDING_TTL_SECONDS,
  MfaSelfService,
  mfaSelfKey,
} from './mfa-self.service';
import * as totp from './totp';

const MEMBER = '64b0000000000000000000c1';
const BOT = '64b0000000000000000000b0';
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const OTHER_SECRET = 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU';
const BACKUP = ['AAAAA-BBBBB', 'CCCCC-DDDDD'];

describe('MfaSelfService (opt-in 2FA from Settings)', () => {
  // enroll/start renders a PNG QR (slow under Jest, see mfa.service.spec).
  jest.setTimeout(30_000);

  let redis: FakeRedis;
  let crypto: MfaCryptoService;
  let codes: MfaCodeService;
  let users: ReturnType<typeof createFakeUserModel>;
  let claims: { resolve: jest.Mock };
  let sso: { isEnforcedFor: jest.Mock };
  let audit: { record: jest.Mock };
  let service: MfaSelfService;

  const member = (extra: Partial<FakeUser> = {}): FakeUser => ({
    _id: MEMBER,
    email: 'alice@acme.com',
    displayName: 'Alice',
    status: 'active',
    ...extra,
  });
  const enrolled = () =>
    member({
      mfa: {
        enabled: true,
        secretEnc: crypto.encrypt(SECRET, MEMBER),
        enrolledAt: new Date(),
        backupCodeHashes: BACKUP.map((c) => hashBackupCode(c.replace('-', ''))),
      },
    });
  const setup = (...seed: FakeUser[]) => {
    users = createFakeUserModel(...seed);
    service = new MfaSelfService(
      users as never,
      redis as never,
      codes,
      crypto,
      claims as never,
      sso as never,
      audit as never,
    );
  };
  const asRole = (role: string, perms: string[] = []) =>
    claims.resolve.mockResolvedValue({ role, perms, depts: [] });
  const seedPending = () =>
    redis.set(
      mfaSelfKey(MEMBER),
      crypto.encrypt(SECRET, MEMBER),
      'EX',
      MFA_SELF_PENDING_TTL_SECONDS,
    );
  const nowCode = () => authenticator.generate(SECRET);
  const rejects = (
    p: Promise<unknown>,
    status: number,
    code: string,
    params?: Record<string, unknown>,
  ) =>
    expect(p).rejects.toMatchObject({
      status,
      response: { code, ...(params ? { params } : {}) },
    });

  beforeEach(() => {
    redis = new FakeRedis();
    crypto = new MfaCryptoService({
      get: (k: string) => (k === 'SESSION_SECRET' ? 's'.repeat(64) : undefined),
    } as unknown as ConfigService);
    codes = new MfaCodeService(redis as never);
    claims = { resolve: jest.fn() };
    asRole('Member', ['USE_GROUP_BOT']);
    sso = { isEnforcedFor: jest.fn().mockResolvedValue(false) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(totp, 'generateTotpSecret').mockReturnValue(SECRET);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('enroll/start (real timers: QR rendering)', () => {
    it('QR + manual key; the pending secret is stored encrypted for 10 minutes', async () => {
      setup(member());
      const res = await service.enrollStart(MEMBER);
      expect(res.secret).toBe(SECRET);
      expect(res.otpauthUrl).toContain(`secret=${SECRET}`);
      expect(res.otpauthUrl).toContain('alice%40acme.com');
      expect(res.qrDataUrl).toMatch(/^data:image\/png;base64,/);
      const stored = await redis.get(mfaSelfKey(MEMBER));
      expect(stored).not.toContain(SECRET);
      expect(crypto.decrypt(stored!, MEMBER)).toBe(SECRET);
      // Real timers: the QR rendering may take a few seconds under Jest.
      const ttl = await redis.ttl(mfaSelfKey(MEMBER));
      expect(ttl).toBeLessThanOrEqual(MFA_SELF_PENDING_TTL_SECONDS);
      expect(ttl).toBeGreaterThan(MFA_SELF_PENDING_TTL_SECONDS - 60);
    });

    it('the same secret on every call while it lives (a double-fired start keeps the QR valid)', async () => {
      setup(member());
      (totp.generateTotpSecret as jest.Mock)
        .mockReturnValueOnce(SECRET)
        .mockReturnValueOnce(OTHER_SECRET);
      const first = await service.enrollStart(MEMBER);
      const second = await service.enrollStart(MEMBER);
      expect(second.secret).toBe(first.secret);
      expect(second.secret).toBe(SECRET);
    });

    it('already enrolled → 400 MFA_ALREADY_ENROLLED, nothing stored', async () => {
      setup(enrolled());
      await rejects(service.enrollStart(MEMBER), 400, 'MFA_ALREADY_ENROLLED');
      expect(redis.keys('mfa:self:')).toEqual([]);
    });

    it('covered by Require SSO → 403 SSO_REQUIRED', async () => {
      setup(member());
      sso.isEnforcedFor.mockResolvedValue(true);
      await rejects(service.enrollStart(MEMBER), 403, 'SSO_REQUIRED');
      expect(redis.keys('mfa:self:')).toEqual([]);
    });

    it.each([
      ['a bot', BOT],
      ['an unknown id', '64b0000000000000000000ff'],
      ['a malformed id', 'nope'],
    ])('%s → 404 USER_NOT_FOUND', async (_l, id) => {
      setup(member(), {
        _id: BOT,
        email: 'ai@pon',
        displayName: 'PON AI',
        isBot: true,
      });
      await rejects(service.enrollStart(id), 404, 'USER_NOT_FOUND');
    });
  });

  describe('enroll/confirm', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-10-07T10:00:05Z') });
    });

    it('right code → enrolled (encrypted secret, hashed codes), 10 codes once, pending gone, audited', async () => {
      setup(member());
      await seedPending();
      const { backupCodes } = await service.enrollConfirm(MEMBER, nowCode());
      expect(backupCodes).toHaveLength(10);
      backupCodes.forEach((c) =>
        expect(c).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/),
      );
      const mfa = users.users.get(MEMBER)!.mfa!;
      expect(mfa.enabled).toBe(true);
      expect(new Date(mfa.enrolledAt!).getTime()).toBe(Date.now());
      expect(crypto.decrypt(mfa.secretEnc!, MEMBER)).toBe(SECRET);
      expect(mfa.backupCodeHashes).toEqual(
        backupCodes.map((c) => hashBackupCode(c.replace('-', ''))),
      );
      expect(redis.keys('mfa:self:')).toEqual([]);
      expect(audit.record).toHaveBeenCalledWith({
        actorId: MEMBER,
        action: 'mfa.enrolled',
        targetType: 'member',
        targetId: MEMBER,
        meta: { via: 'settings' },
      });
    });

    it('an Owner / Admin who is not enrolled may also turn it on here', async () => {
      asRole('Admin', ['MANAGE_MEMBERS']);
      setup(member());
      await seedPending();
      await expect(
        service.enrollConfirm(MEMBER, nowCode()),
      ).resolves.toMatchObject({ backupCodes: expect.any(Array) });
    });

    it('wrong code → 400 MFA_CODE_INVALID (never 401) with remaining; pending kept', async () => {
      setup(member());
      await seedPending();
      await rejects(
        service.enrollConfirm(MEMBER, '000000'),
        400,
        'MFA_CODE_INVALID',
        { remaining: 4 },
      );
      expect(users.users.get(MEMBER)!.mfa).toBeUndefined();
      expect(redis.keys('mfa:self:')).toHaveLength(1);
    });

    it('5 wrong codes → 400 MFA_TOO_MANY_ATTEMPTS, then refused even with a right code until the window passes', async () => {
      setup(member());
      await seedPending();
      for (let i = 0; i < 4; i++) {
        await service.enrollConfirm(MEMBER, '000000').catch(() => undefined);
      }
      await rejects(
        service.enrollConfirm(MEMBER, '000000'),
        400,
        'MFA_TOO_MANY_ATTEMPTS',
      );
      await rejects(
        service.enrollConfirm(MEMBER, nowCode()),
        400,
        'MFA_TOO_MANY_ATTEMPTS',
      );
      jest.advanceTimersByTime(15 * 60 * 1000);
      await seedPending();
      await expect(
        service.enrollConfirm(MEMBER, nowCode()),
      ).resolves.toMatchObject({ backupCodes: expect.any(Array) });
    });

    it('never started → 400 MFA_NOT_ENROLLED', async () => {
      setup(member());
      await rejects(
        service.enrollConfirm(MEMBER, nowCode()),
        400,
        'MFA_NOT_ENROLLED',
      );
    });

    it('pending secret expired (10 minutes) → 400 MFA_NOT_ENROLLED', async () => {
      setup(member());
      await seedPending();
      jest.advanceTimersByTime(MFA_SELF_PENDING_TTL_SECONDS * 1000);
      await rejects(
        service.enrollConfirm(MEMBER, nowCode()),
        400,
        'MFA_NOT_ENROLLED',
      );
    });

    it('already enrolled (e.g. another tab confirmed) → 400 MFA_ALREADY_ENROLLED, pending dropped', async () => {
      setup(enrolled());
      await seedPending();
      await rejects(
        service.enrollConfirm(MEMBER, nowCode()),
        400,
        'MFA_ALREADY_ENROLLED',
      );
      expect(redis.keys('mfa:self:')).toEqual([]);
    });

    it('covered by Require SSO → 403 SSO_REQUIRED, nothing written', async () => {
      setup(member());
      await seedPending();
      sso.isEnforcedFor.mockResolvedValue(true);
      await rejects(
        service.enrollConfirm(MEMBER, nowCode()),
        403,
        'SSO_REQUIRED',
      );
      expect(users.users.get(MEMBER)!.mfa).toBeUndefined();
    });
  });

  describe('disable', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-10-07T10:00:05Z') });
    });

    it('Member + current TOTP → enrollment and backup codes cleared, audited', async () => {
      setup(enrolled());
      await expect(
        service.disable(MEMBER, { code: nowCode() }),
      ).resolves.toEqual({ success: true });
      expect(users.users.get(MEMBER)!.mfa).toBeUndefined();
      expect(audit.record).toHaveBeenCalledWith({
        actorId: MEMBER,
        action: 'mfa.disabled',
        targetType: 'member',
        targetId: MEMBER,
        meta: { method: 'totp' },
      });
    });

    it('Member + unused backup code (any case / spacing) → cleared', async () => {
      setup(enrolled());
      await expect(
        service.disable(MEMBER, { backupCode: 'ccccc ddddd' }),
      ).resolves.toEqual({ success: true });
      expect(users.users.get(MEMBER)!.mfa).toBeUndefined();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ meta: { method: 'backup_code' } }),
      );
    });

    it.each([
      ['a wrong TOTP', { code: '000000' }],
      ['an unknown backup code', { backupCode: 'ZZZZZ-ZZZZZ' }],
      [
        'both code and backupCode',
        { code: '123456', backupCode: 'AAAAA-BBBBB' },
      ],
      ['neither', {}],
    ])(
      '%s → 400 MFA_CODE_INVALID (never 401); still enrolled',
      async (_l, input) => {
        setup(enrolled());
        await rejects(service.disable(MEMBER, input), 400, 'MFA_CODE_INVALID', {
          remaining: 4,
        });
        expect(users.users.get(MEMBER)!.mfa?.enabled).toBe(true);
        expect(audit.record).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['Owner', []],
      ['Admin', ['MANAGE_MEMBERS']],
      ['a custom role with MANAGE_WORKSPACE', ['MANAGE_WORKSPACE']],
    ])(
      '%s → 400 MFA_REQUIRED_BY_ROLE even with a right code; nothing counted',
      async (role, perms) => {
        asRole(role, perms);
        setup(enrolled());
        await rejects(
          service.disable(MEMBER, { code: nowCode() }),
          400,
          'MFA_REQUIRED_BY_ROLE',
        );
        expect(users.users.get(MEMBER)!.mfa?.enabled).toBe(true);
        expect(await codes.failures('account', MEMBER)).toBe(0);
      },
    );

    it('not enrolled → 400 MFA_NOT_ENROLLED', async () => {
      setup(member());
      await rejects(
        service.disable(MEMBER, { code: nowCode() }),
        400,
        'MFA_NOT_ENROLLED',
      );
    });

    it('the wrong-code budget is shared with backup-code regeneration', async () => {
      setup(enrolled());
      for (let i = 0; i < 4; i++) await codes.recordFailure('account', MEMBER);
      await rejects(
        service.disable(MEMBER, { code: '000000' }),
        400,
        'MFA_TOO_MANY_ATTEMPTS',
      );
      await rejects(
        service.disable(MEMBER, { code: nowCode() }),
        400,
        'MFA_TOO_MANY_ATTEMPTS',
      );
      expect(users.users.get(MEMBER)!.mfa?.enabled).toBe(true);
    });

    it('covered by Require SSO → 403 SSO_REQUIRED; a bot → 404', async () => {
      setup(enrolled(), {
        _id: BOT,
        email: 'ai@pon',
        displayName: 'PON AI',
        isBot: true,
      });
      await rejects(
        service.disable(BOT, { code: nowCode() }),
        404,
        'USER_NOT_FOUND',
      );
      sso.isEnforcedFor.mockResolvedValue(true);
      await rejects(
        service.disable(MEMBER, { code: nowCode() }),
        403,
        'SSO_REQUIRED',
      );
      expect(users.users.get(MEMBER)!.mfa?.enabled).toBe(true);
    });
  });

  it('turn on then off: the code used to confirm cannot be replayed, the next one works', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-07T10:00:05Z') });
    setup(member());
    await seedPending();
    const first = nowCode();
    await service.enrollConfirm(MEMBER, first);
    await rejects(
      service.disable(MEMBER, { code: first }),
      400,
      'MFA_CODE_INVALID',
    );
    jest.advanceTimersByTime(30_000);
    await expect(service.disable(MEMBER, { code: nowCode() })).resolves.toEqual(
      { success: true },
    );
    expect(users.users.get(MEMBER)!.mfa).toBeUndefined();
  });
});
