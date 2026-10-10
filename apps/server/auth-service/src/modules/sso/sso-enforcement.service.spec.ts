jest.mock('nanoid', () => ({ nanoid: () => 'test-sid' }));

import { FakeRedis } from '../mfa/fake-redis.spec-helper';
import { SessionService } from '../auth/session.service';
import { SsoEnforcementService } from './sso-enforcement.service';
import { SsoSettings } from './sso-policy';

const OWNER_ROLE = 'rid-owner';

interface Person {
  _id: string;
  email: string;
  roleId?: string;
  isBot?: boolean;
}

describe('SsoEnforcementService ("Require SSO" switch)', () => {
  let settings: SsoSettings;
  let people: Person[];
  let redis: FakeRedis;
  let audit: { record: jest.Mock };
  let service: SsoEnforcementService;

  /** Mongo-ish evaluation of the filter revokeNonSsoSessions builds. */
  const find = jest.fn((filter: Record<string, any>) => {
    const q = {
      select: () => q,
      lean: () => q,
      exec: async () =>
        people.filter(
          (p) =>
            (filter.email as RegExp).test(p.email) &&
            p.isBot !== true &&
            (!filter.roleId || p.roleId !== filter.roleId.$ne),
        ),
    };
    return q;
  });

  const seedSession = async (userId: string, sid: string, method?: string) => {
    await redis.hset(`sess:${sid}`, {
      userId,
      revoked: '0',
      ...(method ? { method } : {}),
    });
    await redis.sadd(`user:${userId}:sessions`, sid);
  };
  const revoked = async (sid: string) =>
    (await redis.hget(`sess:${sid}`, 'revoked')) === '1';

  beforeEach(() => {
    settings = {
      enabled: true,
      enforced: false,
      allowedDomains: ['acme.com'],
      oidcConfigured: true,
    };
    people = [
      { _id: 'member', email: 'jane@acme.com', roleId: 'rid-member' },
      { _id: 'norole', email: 'Kim@ACME.com' },
      { _id: 'owner', email: 'boss@acme.com', roleId: OWNER_ROLE },
      { _id: 'bot', email: 'ai@acme.com', isBot: true },
      { _id: 'guest', email: 'guest@partner.io' },
    ];
    redis = new FakeRedis();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    find.mockClear();
    service = new SsoEnforcementService(
      { getSettings: async () => ({ ...settings }) } as never,
      { find } as never,
      {
        findOne: () => {
          const q = {
            select: () => q,
            lean: () => q,
            exec: async () => ({ _id: OWNER_ROLE }),
          };
          return q;
        },
      } as never,
      new SessionService(redis as never),
      audit as never,
    );
  });

  describe('plan (validation on save)', () => {
    it('enabling with SSO on + a domain + OIDC env → ok', async () => {
      const plan = await service.plan({
        enabled: true,
        enforced: true,
        allowedDomains: ['acme.com'],
      });
      expect(plan.sso).toEqual({
        enabled: true,
        enforced: true,
        allowedDomains: ['acme.com'],
      });
      expect(plan.after.enforced).toBe(true);
    });

    it.each([
      ['SSO disabled', { enabled: false, allowedDomains: ['acme.com'] }, true],
      ['no allowed domain', { enabled: true, allowedDomains: [] }, true],
      ['blank domains only', { enabled: true, allowedDomains: [' '] }, true],
      [
        'OIDC not configured by env',
        { enabled: true, allowedDomains: ['acme.com'] },
        false,
      ],
    ])(
      'enabling with %s → 400 SSO_ENFORCE_NOT_READY',
      async (_label, patch, oidc) => {
        settings.oidcConfigured = oidc;
        await expect(
          service.plan({ ...patch, enforced: true }),
        ).rejects.toMatchObject({
          status: 400,
          response: { code: 'SSO_ENFORCE_NOT_READY' },
        });
      },
    );

    it('an omitted `enforced` keeps the stored value (older clients never switch it off)', async () => {
      settings.enforced = true;
      const plan = await service.plan({
        enabled: true,
        allowedDomains: ['acme.com'],
        groupRoleMap: { staff: 'Member' },
      });
      expect(plan.sso.enforced).toBe(true);
    });

    it('turning SSO off while enforced requires enforced:false too', async () => {
      settings.enforced = true;
      await expect(
        service.plan({ enabled: false, allowedDomains: ['acme.com'] }),
      ).rejects.toMatchObject({ response: { code: 'SSO_ENFORCE_NOT_READY' } });
      await expect(
        service.plan({
          enabled: false,
          enforced: false,
          allowedDomains: ['acme.com'],
        }),
      ).resolves.toMatchObject({ sso: { enforced: false } });
    });

    it('enforced:false is always accepted', async () => {
      settings.oidcConfigured = false;
      await expect(
        service.plan({ enabled: false, enforced: false }),
      ).resolves.toMatchObject({ sso: { enforced: false } });
    });
  });

  describe('apply (after save): sign-out by session method', () => {
    beforeEach(async () => {
      await seedSession('member', 'm-pw', 'password');
      await seedSession('member', 'm-gg', 'google');
      await seedSession('member', 'm-sso', 'oidc');
      await seedSession('norole', 'n-legacy');
      await seedSession('owner', 'o-pw', 'password');
      await seedSession('bot', 'b-pw', 'password');
      await seedSession('guest', 'g-pw', 'password');
    });

    it('switching ON revokes non-SSO sessions of covered non-Owner people only', async () => {
      const plan = await service.plan({
        enabled: true,
        enforced: true,
        allowedDomains: ['acme.com'],
      });
      await service.apply(plan, 'actor');

      expect(await revoked('m-pw')).toBe(true);
      expect(await revoked('m-gg')).toBe(true);
      expect(await revoked('n-legacy')).toBe(true); // no method recorded
      expect(await revoked('m-sso')).toBe(false); // SSO session kept
      expect(await revoked('o-pw')).toBe(false); // Owner = break-glass
      expect(await revoked('b-pw')).toBe(false); // bot
      expect(await revoked('g-pw')).toBe(false); // other domain

      expect(redis.published.map((p) => JSON.parse(p.message))).toEqual([
        { userId: 'member', reason: 'sso_enforced' },
        { userId: 'norole', reason: 'sso_enforced' },
      ]);
      expect(audit.record).toHaveBeenCalledWith({
        actorId: 'actor',
        action: 'sso.enforcement_changed',
        targetType: 'workspace',
        meta: { enforced: true, domains: ['acme.com'], membersSignedOut: 2 },
      });
    });

    it('saving again while already on (same domains) revokes nothing', async () => {
      settings.enforced = true;
      const plan = await service.plan({
        enabled: true,
        allowedDomains: ['acme.com'],
      });
      await service.apply(plan, 'actor');
      expect(await revoked('m-pw')).toBe(false);
      expect(find).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('a domain added while on → only that domain is swept', async () => {
      settings.enforced = true;
      const plan = await service.plan({
        enabled: true,
        allowedDomains: ['acme.com', 'partner.io'],
      });
      await service.apply(plan, 'actor');
      expect(await revoked('g-pw')).toBe(true);
      expect(await revoked('m-pw')).toBe(false);
    });

    it('switching OFF revokes nothing (passwords work again) and is audited', async () => {
      settings.enforced = true;
      const plan = await service.plan({
        enabled: true,
        enforced: false,
        allowedDomains: ['acme.com'],
      });
      await service.apply(plan, 'actor');
      expect(find).not.toHaveBeenCalled();
      expect(await revoked('m-pw')).toBe(false);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sso.enforcement_changed',
          meta: { enforced: false, domains: [], membersSignedOut: 0 },
        }),
      );
    });

    it('domain patterns are escaped (a "." is not a wildcard)', async () => {
      people.push({ _id: 'trick', email: 'x@acmexcom' });
      await seedSession('trick', 't-pw', 'password');
      const plan = await service.plan({
        enabled: true,
        enforced: true,
        allowedDomains: ['acme.com'],
      });
      await service.apply(plan, 'actor');
      expect(await revoked('t-pw')).toBe(false);
    });
  });
});
