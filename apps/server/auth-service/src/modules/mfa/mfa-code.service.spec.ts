import { authenticator } from 'otplib';
import { FakeRedis } from './fake-redis.spec-helper';
import {
  BACKUP_CODE_COUNT,
  hashBackupCode,
  MfaCodeService,
  normalizeBackupCode,
} from './mfa-code.service';
import { matchTotpStep, totpKeyUri } from './totp';

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

describe('MfaCodeService', () => {
  let redis: FakeRedis;
  let codes: MfaCodeService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-03T10:00:10Z') });
    redis = new FakeRedis();
    codes = new MfaCodeService(redis as never);
  });
  afterEach(() => jest.useRealTimers());

  describe('TOTP (Google Authenticator compatible)', () => {
    it('accepts the current code, and codes one step early / late (clock drift)', () => {
      const now = Date.now();
      const at = (ms: number) =>
        authenticator.clone({ epoch: ms }).generate(SECRET);
      expect(matchTotpStep(at(now), SECRET, now)).not.toBeNull();
      expect(matchTotpStep(at(now - 30_000), SECRET, now)).not.toBeNull();
      expect(matchTotpStep(at(now + 30_000), SECRET, now)).not.toBeNull();
      expect(matchTotpStep(at(now - 90_000), SECRET, now)).toBeNull();
      expect(matchTotpStep('12345', SECRET, now)).toBeNull();
      expect(matchTotpStep('abcdef', SECRET, now)).toBeNull();
    });

    it('checkTotp: a valid code works once (replay rejected), spaces tolerated', async () => {
      const code = authenticator.generate(SECRET);
      const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
      expect(await codes.checkTotp('u1', SECRET, spaced)).toBe(true);
      expect(await codes.checkTotp('u1', SECRET, code)).toBe(false);
      // Another user with the same secret is independent.
      expect(await codes.checkTotp('u2', SECRET, code)).toBe(true);
      // The next 30 s step yields a new, accepted code.
      jest.advanceTimersByTime(30_000);
      expect(
        await codes.checkTotp('u1', SECRET, authenticator.generate(SECRET)),
      ).toBe(true);
    });

    it('checkTotp rejects wrong / non-string input', async () => {
      expect(await codes.checkTotp('u1', SECRET, '000000')).toBe(false);
      expect(await codes.checkTotp('u1', SECRET, 123456)).toBe(false);
      expect(await codes.checkTotp('u1', SECRET, undefined)).toBe(false);
    });

    it('otpauth URL: issuer PON, account = email, SHA1 / 6 digits / 30 s', () => {
      const url = totpKeyUri('jane@acme.com', SECRET);
      expect(url).toMatch(/^otpauth:\/\/totp\/PON:jane(%40|@)acme\.com\?/);
      expect(url).toContain(`secret=${SECRET}`);
      expect(url).toContain('issuer=PON');
      expect(url).toContain('algorithm=SHA1');
      expect(url).toContain('digits=6');
      expect(url).toContain('period=30');
    });
  });

  describe('backup codes', () => {
    it('10 unique XXXXX-XXXXX base32 codes; only sha256 hashes are kept', () => {
      const { codes: plain, hashes } = codes.newBackupCodes();
      expect(plain).toHaveLength(BACKUP_CODE_COUNT);
      expect(new Set(plain).size).toBe(BACKUP_CODE_COUNT);
      for (const c of plain) expect(c).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
      expect(hashes).toEqual(
        plain.map((c) => hashBackupCode(c.replace('-', ''))),
      );
      for (const h of hashes) {
        expect(h).toMatch(/^[0-9a-f]{64}$/);
        expect(plain.some((c) => h.includes(c))).toBe(false);
      }
    });

    it('matches a code case/spacing-insensitively and returns its hash', () => {
      const { codes: plain, hashes } = codes.newBackupCodes();
      const [first] = plain;
      expect(codes.matchBackupCode(hashes, first)).toBe(hashes[0]);
      expect(codes.matchBackupCode(hashes, first.toLowerCase())).toBe(
        hashes[0],
      );
      expect(codes.matchBackupCode(hashes, first.replace('-', ' '))).toBe(
        hashes[0],
      );
      expect(codes.matchBackupCode(hashes, 'AAAAA-AAAAA')).toBeNull();
      expect(codes.matchBackupCode(hashes, '123456')).toBeNull();
      expect(codes.matchBackupCode([], first)).toBeNull();
    });

    it('normalizeBackupCode only accepts 10 base32 characters', () => {
      expect(normalizeBackupCode('abcde-fgh23')).toBe('ABCDEFGH23');
      expect(normalizeBackupCode('ABCDE-FGH01')).toBeNull(); // 0/1 are not base32
      expect(normalizeBackupCode('ABCDE')).toBeNull();
      expect(normalizeBackupCode(42)).toBeNull();
    });
  });

  describe('per-user failure budget', () => {
    it('counts within a window, then expires', async () => {
      expect(await codes.failures('signin', 'u1')).toBe(0);
      expect(await codes.recordFailure('signin', 'u1')).toBe(1);
      expect(await codes.recordFailure('signin', 'u1')).toBe(2);
      expect(await codes.failures('regen', 'u1')).toBe(0);
      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(await codes.failures('signin', 'u1')).toBe(0);
      await codes.recordFailure('regen', 'u1');
      await codes.clearFailures('regen', 'u1');
      expect(await codes.failures('regen', 'u1')).toBe(0);
    });
  });
});
