jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { FakeRedis } from './fake-redis.spec-helper';
import { createFakeUserModel } from './fake-user-model.spec-helper';
import { MfaAccountService } from './mfa-account.service';
import { hashBackupCode, MfaCodeService } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';

const OWNER = '64b0000000000000000000a1';
const ADMIN = '64b0000000000000000000a2';
const BOT = '64b0000000000000000000b0';
const MEMBER = '64b0000000000000000000c1';
const CUSTOM = '64b0000000000000000000c2';
const ADMIN2 = '64b0000000000000000000a3';
const ADMIN_LIKE = '64b0000000000000000000a4';
/** Role claims of each seeded user, as ClaimsService.resolve() returns them. */
const CLAIMS: Record<string, { role: string; perms: string[] }> = {
  [OWNER]: { role: 'Owner', perms: ['MANAGE_WORKSPACE', 'MANAGE_MEMBERS'] },
  [ADMIN]: { role: 'Admin', perms: ['MANAGE_MEMBERS'] },
  [ADMIN2]: { role: 'Admin', perms: ['MANAGE_MEMBERS'] },
  [ADMIN_LIKE]: { role: 'Ops lead', perms: ['MANAGE_ROLES'] },
  [MEMBER]: { role: 'Member', perms: ['USE_GROUP_BOT'] },
  [CUSTOM]: { role: 'Manager', perms: ['RUN_SENSITIVE_SKILL'] },
};
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const OLD_HASH = hashBackupCode('AAAAABBBBB');

describe('MfaAccountService', () => {
  let crypto: MfaCryptoService;
  let users: ReturnType<typeof createFakeUserModel>;
  let session: { revokeAllSessions: jest.Mock };
  let audit: { record: jest.Mock };
  let claims: { resolve: jest.Mock };
  let service: MfaAccountService;

  const enrolled = (_id: string) => ({
    _id,
    email: `${_id}@acme.com`,
    displayName: _id,
    mfa: {
      enabled: true,
      secretEnc: crypto.encrypt(SECRET, _id),
      enrolledAt: new Date(),
      backupCodeHashes: [OLD_HASH],
    },
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-03T10:00:05Z') });
    crypto = new MfaCryptoService({
      get: (k: string) => (k === 'SESSION_SECRET' ? 's'.repeat(64) : undefined),
    } as unknown as ConfigService);
    users = createFakeUserModel(
      enrolled(OWNER),
      enrolled(ADMIN),
      enrolled(ADMIN2),
      enrolled(ADMIN_LIKE),
      enrolled(MEMBER),
      enrolled(CUSTOM),
      {
        _id: BOT,
        email: 'ai@pon',
        displayName: 'PON AI',
        isBot: true,
      },
    );
    claims = {
      resolve: jest.fn(async (id: string) => ({ ...CLAIMS[id], depts: [] })),
    };
    session = { revokeAllSessions: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new MfaAccountService(
      users as never,
      new MfaCodeService(new FakeRedis() as never),
      crypto,
      session as never,
      audit as never,
      claims as never,
    );
  });
  afterEach(() => jest.useRealTimers());

  describe('regenerate backup codes', () => {
    it('valid current TOTP → 10 new codes replace the old hashes, audited', async () => {
      const { backupCodes } = await service.regenerateBackupCodes(
        OWNER,
        authenticator.generate(SECRET),
      );
      expect(backupCodes).toHaveLength(10);
      const hashes = users.users.get(OWNER)!.mfa!.backupCodeHashes!;
      expect(hashes).not.toContain(OLD_HASH);
      expect(hashes).toEqual(
        backupCodes.map((c) => hashBackupCode(c.replace('-', ''))),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: OWNER,
          action: 'mfa.backup_codes_regenerated',
        }),
      );
    });

    it('wrong code → 400 MFA_CODE_INVALID (never 401) with remaining; codes unchanged', async () => {
      await expect(
        service.regenerateBackupCodes(OWNER, '000000'),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'MFA_CODE_INVALID', params: { remaining: 4 } },
      });
      expect(users.users.get(OWNER)!.mfa!.backupCodeHashes).toEqual([OLD_HASH]);
    });

    it('a backup code is not accepted instead of the TOTP', async () => {
      await expect(
        service.regenerateBackupCodes(OWNER, 'AAAAA-BBBBB'),
      ).rejects.toMatchObject({
        response: { code: 'MFA_CODE_INVALID' },
      });
    });

    it('5 wrong codes → 400 MFA_TOO_MANY_ATTEMPTS, then refused even with a valid code', async () => {
      for (let i = 0; i < 4; i++) {
        await service
          .regenerateBackupCodes(OWNER, '000000')
          .catch(() => undefined);
      }
      await expect(
        service.regenerateBackupCodes(OWNER, '000000'),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'MFA_TOO_MANY_ATTEMPTS' },
      });
      await expect(
        service.regenerateBackupCodes(OWNER, authenticator.generate(SECRET)),
      ).rejects.toMatchObject({ response: { code: 'MFA_TOO_MANY_ATTEMPTS' } });
    });

    it('not enrolled → 400 MFA_NOT_ENROLLED', async () => {
      users.users.get(ADMIN)!.mfa = undefined;
      await expect(
        service.regenerateBackupCodes(ADMIN, '123456'),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'MFA_NOT_ENROLLED' },
      });
    });
  });

  describe('admin reset (POST /admin/members/:id/mfa/reset)', () => {
    const owner = {
      sub: OWNER,
      role: 'Owner',
      perms: ['MANAGE_WORKSPACE', 'MANAGE_MEMBERS'],
    };
    const admin = {
      sub: ADMIN,
      role: 'Admin',
      perms: ['MANAGE_MEMBERS', 'MANAGE_ROLES'],
    };

    it('Owner resets another member: enrollment + backup codes cleared, sessions revoked, audited', async () => {
      await expect(service.resetForMember(owner, ADMIN)).resolves.toEqual({
        success: true,
      });
      expect(users.users.get(ADMIN)!.mfa).toBeUndefined();
      expect(session.revokeAllSessions).toHaveBeenCalledWith(
        ADMIN,
        'mfa_reset',
      );
      expect(audit.record).toHaveBeenCalledWith({
        actorId: OWNER,
        action: 'mfa.reset',
        targetType: 'member',
        targetId: ADMIN,
        meta: { wasEnabled: true },
      });
    });

    it('Owner can reset another Owner', async () => {
      await expect(
        service.resetForMember({ sub: ADMIN, role: 'Owner' }, OWNER),
      ).resolves.toEqual({ success: true });
    });

    it('Admin (MANAGE_MEMBERS) resets a Member', async () => {
      await expect(service.resetForMember(admin, MEMBER)).resolves.toEqual({
        success: true,
      });
      expect(users.users.get(MEMBER)!.mfa).toBeUndefined();
      expect(claims.resolve).toHaveBeenCalledWith(MEMBER);
    });

    it('Admin resets a custom role without admin capabilities', async () => {
      await expect(service.resetForMember(admin, CUSTOM)).resolves.toEqual({
        success: true,
      });
    });

    it.each([
      ['an Owner', OWNER],
      ['another Admin', ADMIN2],
      ['an admin-like custom role', ADMIN_LIKE],
    ])('Admin cannot reset %s → 403 MFA_RESET_FORBIDDEN', async (_l, id) => {
      await expect(service.resetForMember(admin, id)).rejects.toMatchObject({
        status: 403,
        response: { code: 'MFA_RESET_FORBIDDEN' },
      });
      expect(users.users.get(id)!.mfa?.enabled).toBe(true);
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
    });

    it.each([
      ['Member', ['USE_GROUP_BOT']],
      ['Auditor', ['VIEW_AUDIT_LOG', 'MANAGE_DEPARTMENTS']],
      [undefined, undefined],
    ])(
      'actor %s without MANAGE_MEMBERS → 403 MFA_RESET_FORBIDDEN',
      async (role, perms) => {
        await expect(
          service.resetForMember({ sub: MEMBER, role, perms }, CUSTOM),
        ).rejects.toMatchObject({
          status: 403,
          response: { code: 'MFA_RESET_FORBIDDEN' },
        });
        expect(session.revokeAllSessions).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['Owner', OWNER],
      ['Admin', ADMIN],
    ])(
      '%s on their own account → 400 MFA_RESET_SELF_FORBIDDEN',
      async (role, id) => {
        await expect(
          service.resetForMember(
            { sub: id, role, perms: ['MANAGE_MEMBERS'] },
            id,
          ),
        ).rejects.toMatchObject({
          status: 400,
          response: { code: 'MFA_RESET_SELF_FORBIDDEN' },
        });
        expect(users.users.get(id)!.mfa?.enabled).toBe(true);
      },
    );

    it.each([BOT, '64b0000000000000000000ff', 'not-an-id'])(
      'bot / unknown / malformed %s → 404 MEMBER_NOT_FOUND',
      async (id) => {
        await expect(service.resetForMember(owner, id)).rejects.toMatchObject({
          status: 404,
          response: { code: 'MEMBER_NOT_FOUND' },
        });
        expect(session.revokeAllSessions).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
      },
    );
  });
});
