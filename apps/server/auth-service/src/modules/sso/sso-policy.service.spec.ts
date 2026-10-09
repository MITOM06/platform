import { ConfigService } from '@nestjs/config';
import { SsoPolicyService } from './sso-policy.service';
import {
  emailInDomains,
  isEnforcementActive,
  normalizeDomains,
} from './sso-policy';

const OWNER_ROLE = '64b0000000000000000000f1';
const MEMBER_ROLE = '64b0000000000000000000f2';
const USER_ID = '64b0000000000000000000e1';

/** `.select().lean().exec()` chain resolving to `value`. */
const query = (value: unknown) => {
  const q = { select: () => q, lean: () => q, exec: async () => value };
  return q;
};

describe('SsoPolicyService (who is SSO-enforced)', () => {
  let sso: Record<string, unknown> | undefined;
  let env: Record<string, string>;
  let users: Record<string, unknown>;
  let service: SsoPolicyService;

  beforeEach(() => {
    sso = { enabled: true, enforced: true, allowedDomains: ['Acme.com'] };
    env = {
      OIDC_ENABLED: 'true',
      OIDC_ISSUER: 'https://idp.acme.com',
      OIDC_CLIENT_ID: 'pon',
    };
    users = {};
    const roles: Record<string, { name: string }> = {
      [OWNER_ROLE]: { name: 'Owner' },
      [MEMBER_ROLE]: { name: 'Member' },
    };
    service = new SsoPolicyService(
      { findOne: () => query(sso === undefined ? null : { sso }) } as never,
      { findById: (id: string) => query(roles[id] ?? null) } as never,
      { findById: (id: string) => query(users[id] ?? null) } as never,
      { get: (k: string) => env[k] } as unknown as ConfigService,
    );
  });

  const member = { email: 'jane@acme.com', roleId: MEMBER_ROLE };

  it('member in an allowed domain while enforced → enforced', async () => {
    await expect(service.isEnforcedFor(member)).resolves.toBe(true);
  });

  it('domain match is case-insensitive and exact (no sub-domain / suffix match)', async () => {
    await expect(
      service.isEnforcedFor({ email: 'JANE@ACME.COM' }),
    ).resolves.toBe(true);
    await expect(
      service.isEnforcedFor({ email: 'jane@eu.acme.com' }),
    ).resolves.toBe(false);
    await expect(
      service.isEnforcedFor({ email: 'jane@notacme.com' }),
    ).resolves.toBe(false);
  });

  it('member outside the allowed domains → not enforced', async () => {
    await expect(
      service.isEnforcedFor({ email: 'guest@partner.io', roleId: MEMBER_ROLE }),
    ).resolves.toBe(false);
  });

  it('Owner is exempt (break-glass)', async () => {
    await expect(
      service.isEnforcedFor({ email: 'boss@acme.com', roleId: OWNER_ROLE }),
    ).resolves.toBe(false);
  });

  it('no role / unknown role → treated as a member (enforced)', async () => {
    await expect(
      service.isEnforcedFor({ email: 'jane@acme.com' }),
    ).resolves.toBe(true);
    await expect(
      service.isEnforcedFor({ email: 'jane@acme.com', roleId: 'garbage' }),
    ).resolves.toBe(true);
  });

  it('bot accounts and missing subjects are never enforced', async () => {
    await expect(
      service.isEnforcedFor({ email: 'ai@acme.com', isBot: true }),
    ).resolves.toBe(false);
    await expect(service.isEnforcedFor(null)).resolves.toBe(false);
    await expect(service.isEnforcedFor({ email: '' })).resolves.toBe(false);
  });

  it.each([
    ['switch off', () => (sso!.enforced = false)],
    ['SSO disabled', () => (sso!.enabled = false)],
    ['no allowed domain', () => (sso!.allowedDomains = [])],
    ['only blank domains', () => (sso!.allowedDomains = ['  '])],
    ['OIDC not configured by env', () => (env.OIDC_ENABLED = 'false')],
    ['legacy workspace (no enforced field)', () => delete sso!.enforced],
    ['no workspace document', () => (sso = undefined)],
  ])('%s → not enforced', async (_label, setup) => {
    setup();
    await expect(service.isEnforcedFor(member)).resolves.toBe(false);
  });

  it('assertNotEnforced throws 403 SSO_REQUIRED only for an enforced member', async () => {
    await expect(service.assertNotEnforced(member)).rejects.toMatchObject({
      status: 403,
      response: { code: 'SSO_REQUIRED' },
    });
    await expect(
      service.assertNotEnforced({ email: 'boss@acme.com', roleId: OWNER_ROLE }),
    ).resolves.toBeUndefined();
  });

  it('assertNotEnforcedForUserId loads the user (change-password)', async () => {
    users[USER_ID] = { email: 'jane@acme.com', roleId: MEMBER_ROLE };
    await expect(
      service.assertNotEnforcedForUserId(USER_ID),
    ).rejects.toMatchObject({
      response: { code: 'SSO_REQUIRED' },
    });
    await expect(
      service.assertNotEnforcedForUserId('64b0000000000000000000ee'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertNotEnforcedForUserId('nope'),
    ).resolves.toBeUndefined();
  });

  describe('GET /auth/sso/info', () => {
    it('exposes enforced (and never the domain list)', async () => {
      const info = await service.publicInfo();
      expect(info).toEqual({
        enabled: true,
        enforced: true,
        loginUrl: '/auth/oidc/login',
        buttonLabel: 'Sign in with SSO',
      });
      expect(JSON.stringify(info)).not.toContain('acme');
    });

    it('enforced is false when the switch is not in effect', async () => {
      sso!.enforced = false;
      await expect(service.publicInfo()).resolves.toMatchObject({
        enabled: true,
        enforced: false,
      });
      env.OIDC_ENABLED = '';
      sso!.enforced = true;
      await expect(service.publicInfo()).resolves.toMatchObject({
        enabled: false,
        enforced: false,
        loginUrl: null,
      });
    });
  });
});

describe('sso-policy helpers', () => {
  it('normalizeDomains trims, lower-cases, strips "@", dedupes, drops blanks', () => {
    expect(
      normalizeDomains([' Acme.com', '@acme.com', '', 'b.io', 42]),
    ).toEqual(['acme.com', 'b.io']);
  });

  it('emailInDomains uses the part after the last "@"', () => {
    expect(emailInDomains('a@b@acme.com', ['acme.com'])).toBe(true);
    expect(emailInDomains('no-at-sign', ['acme.com'])).toBe(false);
  });

  it('isEnforcementActive needs every condition', () => {
    const on = {
      enabled: true,
      enforced: true,
      allowedDomains: ['acme.com'],
      oidcConfigured: true,
    };
    expect(isEnforcementActive(on)).toBe(true);
    expect(isEnforcementActive({ ...on, oidcConfigured: false })).toBe(false);
  });
});
