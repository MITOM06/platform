import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { FakeRedis } from './fake-redis.spec-helper';
import { createFakeUserModel, FakeUser } from './fake-user-model.spec-helper';
import { hashBackupCode, MfaCodeService } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';
import { MfaPendingStore, MfaStage } from './mfa-pending.store';
import { MfaService } from './mfa.service';
import * as totp from './totp';

const UID = '64b0000000000000000000a1';
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const BACKUP = ['AAAAA-BBBBB', 'CCCCC-DDDDD'];

describe('MfaService (2FA sign-in step)', () => {
  // PNG rendering (qrcode → pngjs/zlib streams) is ~0.5 s per QR under Jest
  // (~25 ms in plain Node); leave headroom for a fully parallel run.
  jest.setTimeout(30_000);

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
  const enrolledOwner = () =>
    owner({
      mfa: {
        enabled: true,
        secretEnc: crypto.encrypt(SECRET, UID),
        enrolledAt: new Date(),
        backupCodeHashes: BACKUP.map((c) => hashBackupCode(c.replace('-', ''))),
      },
    });
  const setup = (user: FakeUser) => {
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
  const nowCode = () => authenticator.generate(SECRET);

  beforeEach(() => {
    // Real timers: qrcode renders the PNG through streams, which stall under
    // Jest fake timers. The ±1 step TOTP window absorbs a step boundary.
    redis = new FakeRedis();
    pending = new MfaPendingStore(redis as never);
    crypto = new MfaCryptoService({
      get: (k: string) => (k === 'SESSION_SECRET' ? 's'.repeat(64) : undefined),
    } as unknown as ConfigService);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(totp, 'generateTotpSecret').mockReturnValue(SECRET);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('enroll/start', () => {
    it('returns the otpauth URL, manual key and a PNG QR; the same secret on every call', async () => {
      setup(owner());
      const t = await token('enroll');
      const first = await service.enrollStart(t);
      expect(first.secret).toBe(SECRET);
      expect(first.otpauthUrl).toContain('otpauth://totp/PON:');
      expect(first.otpauthUrl).toContain(`secret=${SECRET}`);
      expect(first.qrDataUrl).toMatch(/^data:image\/png;base64,/);

      (totp.generateTotpSecret as jest.Mock).mockReturnValue(
        'KRUGS4ZANFZSAYJAONSWG4TFOQ',
      );
      const again = await service.enrollStart(t);
      expect(again.secret).toBe(SECRET);
      // The pending secret is encrypted in Redis, never stored in plain text.
      const [key] = redis.keys('mfa:pending:');
      const stored = await redis.hget(key, 'secretEnc');
      expect(stored).not.toContain(SECRET);
      expect(crypto.decrypt(stored!, UID)).toBe(SECRET);
      // Nothing is written to the user before confirm.
      expect(users.users.get(UID)!.mfa).toBeUndefined();
    });

    it('a verify-stage token → 400 MFA_ALREADY_ENROLLED', async () => {
      setup(enrolledOwner());
      await expect(
        service.enrollStart(await token('verify')),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'MFA_ALREADY_ENROLLED' },
      });
    });

    it('unknown / missing token → 401 MFA_TOKEN_INVALID', async () => {
      setup(owner());
      for (const t of ['nope', undefined, '']) {
        await expect(service.enrollStart(t)).rejects.toMatchObject({
          status: 401,
          response: { code: 'MFA_TOKEN_INVALID' },
        });
      }
    });

    it('account blocked since the password step → 403 ACCOUNT_BLOCKED and the token is burned', async () => {
      setup(owner({ status: 'blocked' }));
      const t = await token('enroll');
      await expect(service.enrollStart(t)).rejects.toMatchObject({
        status: 403,
        response: { code: 'ACCOUNT_BLOCKED' },
      });
      expect(redis.keys('mfa:pending:')).toEqual([]);
    });
  });

  describe('enroll/confirm', () => {
    it('valid TOTP → enrolled, encrypted secret stored, 10 backup codes returned (hashed at rest), no session fields', async () => {
      setup(owner());
      const t = await token('enroll');
      await service.enrollStart(t);
      const res = await service.enrollConfirm({
        mfaToken: t,
        code: nowCode(),
        deviceId: 'dev-9',
        platform: 'mobile',
      });

      // Only the codes: nothing a caller could issue a session from.
      expect(Object.keys(res)).toEqual(['backupCodes']);
      expect(res.backupCodes).toHaveLength(10);
      for (const c of res.backupCodes)
        expect(c).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);

      const stored = users.users.get(UID)!.mfa!;
      expect(stored.enabled).toBe(true);
      expect(Date.now() - new Date(stored.enrolledAt!).getTime()).toBeLessThan(
        60_000,
      );
      expect(stored.secretEnc).not.toContain(SECRET);
      expect(crypto.decrypt(stored.secretEnc!, UID)).toBe(SECRET);
      expect(stored.backupCodeHashes).toEqual(
        res.backupCodes.map((c) => hashBackupCode(c.replace('-', ''))),
      );
      expect(JSON.stringify(stored)).not.toContain(res.backupCodes[0]);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: UID,
          action: 'mfa.enrolled',
          targetId: UID,
        }),
      );
      // Confirm happens once: the token moved on to the backup-codes step.
      await expect(
        service.enrollConfirm({ mfaToken: t, code: nowCode() }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'MFA_ALREADY_ENROLLED' },
      });
    });

    it('confirm before start → 400 MFA_NOT_ENROLLED', async () => {
      setup(owner());
      await expect(
        service.enrollConfirm({
          mfaToken: await token('enroll'),
          code: '123456',
        }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'MFA_NOT_ENROLLED' },
      });
    });

    it('wrong code → 401 MFA_CODE_INVALID with remaining; nothing enrolled', async () => {
      setup(owner());
      const t = await token('enroll');
      await service.enrollStart(t);
      await expect(
        service.enrollConfirm({ mfaToken: t, code: '000000' }),
      ).rejects.toMatchObject({
        status: 401,
        response: { code: 'MFA_CODE_INVALID', params: { remaining: 4 } },
      });
      expect(users.users.get(UID)!.mfa).toBeUndefined();
    });
  });

  describe('verify', () => {
    it('valid TOTP → passes, token single use, backupCodesRemaining', async () => {
      setup(enrolledOwner());
      const t = await token('verify');
      const res = await service.verify({ mfaToken: t, code: nowCode() });
      expect(res.backupCodesRemaining).toBe(2);
      expect(res.user.email).toBe('owner@acme.com');
      expect(res).toMatchObject({ deviceId: 'web-login', platform: 'web' });
      // The token is checked before the code: any second use is refused.
      await expect(
        service.verify({ mfaToken: t, backupCode: BACKUP[0] }),
      ).rejects.toMatchObject({
        status: 401,
        response: { code: 'MFA_TOKEN_INVALID' },
      });
    });

    it('a code already used to sign in cannot be replayed on a new token', async () => {
      setup(enrolledOwner());
      const code = nowCode();
      await service.verify({ mfaToken: await token('verify'), code });
      await expect(
        service.verify({ mfaToken: await token('verify'), code }),
      ).rejects.toMatchObject({ response: { code: 'MFA_CODE_INVALID' } });
    });

    it('backup code → passes once, is consumed, remaining count drops, audited', async () => {
      setup(enrolledOwner());
      const res = await service.verify({
        mfaToken: await token('verify'),
        backupCode: 'aaaaa-bbbbb',
      });
      expect(res.backupCodesRemaining).toBe(1);
      expect(users.users.get(UID)!.mfa!.backupCodeHashes).toEqual([
        hashBackupCode('CCCCCDDDDD'),
      ]);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'mfa.verified_backup_code',
          meta: { remaining: 1 },
        }),
      );
      // The same backup code is now invalid.
      await expect(
        service.verify({
          mfaToken: await token('verify'),
          backupCode: 'AAAAA-BBBBB',
        }),
      ).rejects.toMatchObject({
        response: { code: 'MFA_CODE_INVALID', params: { remaining: 4 } },
      });
    });

    it('wrong codes: remaining 4..1, then the 5th → MFA_TOO_MANY_ATTEMPTS and the token is burned', async () => {
      setup(enrolledOwner());
      const t = await token('verify');
      for (const remaining of [4, 3, 2, 1]) {
        await expect(
          service.verify({ mfaToken: t, code: '000000' }),
        ).rejects.toMatchObject({
          status: 401,
          response: { code: 'MFA_CODE_INVALID', params: { remaining } },
        });
      }
      await expect(
        service.verify({ mfaToken: t, backupCode: 'ZZZZZ-ZZZZZ' }),
      ).rejects.toMatchObject({
        status: 401,
        response: { code: 'MFA_TOO_MANY_ATTEMPTS' },
      });
      // Even the right code no longer works: restart sign-in.
      await expect(
        service.verify({ mfaToken: t, code: nowCode() }),
      ).rejects.toMatchObject({
        response: { code: 'MFA_TOKEN_INVALID' },
      });
    });

    it('both or neither of code / backupCode count as a wrong attempt', async () => {
      setup(enrolledOwner());
      const t = await token('verify');
      await expect(
        service.verify({
          mfaToken: t,
          code: nowCode(),
          backupCode: 'AAAAA-BBBBB',
        }),
      ).rejects.toMatchObject({
        response: { code: 'MFA_CODE_INVALID', params: { remaining: 4 } },
      });
      await expect(service.verify({ mfaToken: t })).rejects.toMatchObject({
        response: { code: 'MFA_CODE_INVALID', params: { remaining: 3 } },
      });
    });

    it('per-user cap across fresh tokens: after 20 wrong codes even a new token is refused', async () => {
      setup(enrolledOwner());
      for (let i = 0; i < 4; i++) {
        const t = await token('verify');
        for (let j = 0; j < 5; j++) {
          await service
            .verify({ mfaToken: t, code: '000000' })
            .catch(() => undefined);
        }
      }
      await expect(
        service.verify({ mfaToken: await token('verify'), code: nowCode() }),
      ).rejects.toMatchObject({ response: { code: 'MFA_TOO_MANY_ATTEMPTS' } });
    });

    it('enrollment token on verify → 400 MFA_NOT_ENROLLED', async () => {
      setup(owner());
      await expect(
        service.verify({ mfaToken: await token('enroll'), code: '123456' }),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'MFA_NOT_ENROLLED' },
      });
    });

    it('2FA reset by an Owner after the password step → MFA_TOKEN_INVALID (restart = enroll)', async () => {
      setup(owner());
      await expect(
        service.verify({ mfaToken: await token('verify'), code: nowCode() }),
      ).rejects.toMatchObject({
        status: 401,
        response: { code: 'MFA_TOKEN_INVALID' },
      });
    });

    it('TTL: a token older than 5 minutes is refused', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-03T10:00:05Z') });
      setup(enrolledOwner());
      const t = await token('verify');
      jest.advanceTimersByTime(5 * 60 * 1000);
      await expect(
        service.verify({ mfaToken: t, code: nowCode() }),
      ).rejects.toMatchObject({
        response: { code: 'MFA_TOKEN_INVALID' },
      });
    });
  });
});
