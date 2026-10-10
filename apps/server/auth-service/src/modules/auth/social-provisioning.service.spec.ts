import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Role } from '@platform/database';
import { SocialProvisioningService } from './social-provisioning.service';
import { UsersService } from '../users/users.service';
import { InvitationsService } from '../invitations/invitations.service';
import { InvitationAcceptService } from '../invitations/invitation-accept.service';
import { SsoPolicyService } from '../sso/sso-policy.service';

const ex = (v: any) => ({ exec: jest.fn().mockResolvedValue(v) });
const oid = (s: string) => ({ toString: () => s });

describe('SocialProvisioningService (invite-only rules D7/D8)', () => {
  let service: SocialProvisioningService;
  let users: Record<string, jest.Mock>;
  let invitations: { findPendingByEmail: jest.Mock };
  let accept: { acceptWithSso: jest.Mock; consumeForUser: jest.Mock };
  let config: Record<string, string>;
  let roleModel: { findOne: jest.Mock };
  /** Emails covered by Require SSO in this test. */
  let enforced: string[];

  const profile = {
    id: 'g-1',
    email: 'Jane@Acme.com',
    displayName: 'Jane',
    emailVerified: true,
  };

  beforeEach(async () => {
    users = {
      findBySocialId: jest.fn().mockResolvedValue(null),
      findByEmailInsensitive: jest.fn().mockResolvedValue(null),
      updateSocialId: jest.fn().mockResolvedValue(undefined),
      create: jest.fn(async (d: any) => ({ _id: oid('created'), ...d })),
    };
    invitations = { findPendingByEmail: jest.fn().mockResolvedValue(null) };
    accept = {
      acceptWithSso: jest.fn(async () => ({ _id: oid('jit-from-invite') })),
      consumeForUser: jest.fn().mockResolvedValue(undefined),
    };
    config = {};
    enforced = [];
    roleModel = {
      findOne: jest
        .fn()
        .mockReturnValue(ex({ _id: oid('role-owner'), name: 'Owner' })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SocialProvisioningService,
        { provide: UsersService, useValue: users },
        { provide: InvitationsService, useValue: invitations },
        { provide: InvitationAcceptService, useValue: accept },
        { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
        { provide: getModelToken(Role.name), useValue: roleModel },
        {
          provide: SsoPolicyService,
          useValue: {
            assertNotEnforced: jest.fn(
              async (s: { email?: string; roleId?: unknown }) => {
                const email = String(s?.email ?? '').toLowerCase();
                // An Owner (invitation) is exempt, as in SsoPolicyService.
                if (
                  enforced.includes(email) &&
                  String(s?.roleId) !== 'role-owner'
                ) {
                  const { ssoRequired } =
                    await import('../sso/sso-policy.service');
                  throw ssoRequired();
                }
              },
            ),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(SocialProvisioningService);
  });

  it('existing active user → id (links the provider if missing)', async () => {
    users.findByEmailInsensitive.mockResolvedValue({
      _id: oid('u1'),
      status: 'active',
      socialLinks: {},
    });
    await expect(service.resolveUserId(profile, 'google')).resolves.toBe('u1');
    expect(users.findByEmailInsensitive).toHaveBeenCalledWith('jane@acme.com');
    expect(users.updateSocialId).toHaveBeenCalledWith('u1', 'google', 'g-1');
    expect(users.create).not.toHaveBeenCalled();
  });

  it('existing account by email but the IdP did not verify the email → 401 SSO_EMAIL_UNVERIFIED, nothing linked', async () => {
    users.findByEmailInsensitive.mockResolvedValue({
      _id: oid('u1'),
      status: 'active',
      socialLinks: {},
    });
    for (const emailVerified of [false, undefined]) {
      await expect(
        service.resolveUserId({ ...profile, emailVerified }, 'oidc'),
      ).rejects.toMatchObject({
        status: 401,
        response: { code: 'SSO_EMAIL_UNVERIFIED' },
      });
    }
    expect(users.updateSocialId).not.toHaveBeenCalled();
  });

  it('existing account already linked to a DIFFERENT provider id → 403 SOCIAL_ACCOUNT_CONFLICT', async () => {
    users.findByEmailInsensitive.mockResolvedValue({
      _id: oid('u1'),
      status: 'active',
      socialLinks: { google: 'g-original' },
    });
    await expect(service.resolveUserId(profile, 'google')).rejects.toMatchObject({
      status: 403,
      response: { code: 'SOCIAL_ACCOUNT_CONFLICT' },
    });
    expect(users.updateSocialId).not.toHaveBeenCalled();
  });

  it('a user already linked by provider id signs in regardless of the email claim', async () => {
    users.findBySocialId.mockResolvedValue({
      _id: oid('u1'),
      status: 'active',
      socialLinks: { google: 'g-1' },
    });
    await expect(
      service.resolveUserId({ ...profile, emailVerified: undefined }, 'google'),
    ).resolves.toBe('u1');
    expect(users.findByEmailInsensitive).not.toHaveBeenCalled();
  });

  it('bootstrap owner creation requires a verified email (it grants Owner)', async () => {
    config.BOOTSTRAP_OWNER_EMAIL = 'jane@acme.com';
    await expect(
      service.resolveUserId({ ...profile, emailVerified: false }, 'oidc', { allowJit: true }),
    ).rejects.toMatchObject({ response: { code: 'SSO_EMAIL_UNVERIFIED' } });
    expect(users.create).not.toHaveBeenCalled();
  });

  it('JIT creation on an allowed domain keeps working without a verified-email claim', async () => {
    await expect(
      service.resolveUserId({ ...profile, emailVerified: undefined }, 'oidc', {
        allowJit: true,
      }),
    ).resolves.toBe('created');
  });

  it('blocked user → 403 ACCOUNT_BLOCKED', async () => {
    users.findBySocialId.mockResolvedValue({
      _id: oid('u1'),
      status: 'blocked',
      socialLinks: { google: 'g-1' },
    });
    await expect(
      service.resolveUserId(profile, 'google'),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'ACCOUNT_BLOCKED' },
    });
  });

  it('unknown email → 403 ACCOUNT_NOT_PROVISIONED (no account created)', async () => {
    await expect(
      service.resolveUserId(profile, 'google'),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'ACCOUNT_NOT_PROVISIONED' },
    });
    expect(users.create).not.toHaveBeenCalled();
  });

  it('unknown email with a live invitation → 403 INVITATION_PENDING', async () => {
    invitations.findPendingByEmail.mockResolvedValue({ _id: oid('inv1') });
    await expect(
      service.resolveUserId(profile, 'google'),
    ).rejects.toMatchObject({
      response: { code: 'INVITATION_PENDING' },
    });
  });

  it('missing email → 401 SOCIAL_EMAIL_UNAVAILABLE', async () => {
    await expect(
      service.resolveUserId({ id: 'x' }, 'google'),
    ).rejects.toMatchObject({
      status: 401,
      response: { code: 'SOCIAL_EMAIL_UNAVAILABLE' },
    });
  });

  it('BOOTSTRAP_OWNER_EMAIL (case-insensitive) → created active with the Owner role', async () => {
    config.BOOTSTRAP_OWNER_EMAIL = 'JANE@acme.com';
    invitations.findPendingByEmail.mockResolvedValue({ _id: 'boot-inv' });

    await expect(service.resolveUserId(profile, 'google')).resolves.toBe(
      'created',
    );

    const created = users.create.mock.calls[0][0];
    expect(created).toMatchObject({
      email: 'jane@acme.com',
      status: 'active',
      isVerified: true,
      socialLinks: { google: 'g-1' },
    });
    expect(created.roleId.toString()).toBe('role-owner');
    expect(accept.consumeForUser).toHaveBeenCalledWith(
      'boot-inv',
      'created',
      'google',
    );
  });

  it('OIDC with allowJit → created; a live invitation is consumed', async () => {
    invitations.findPendingByEmail.mockResolvedValue({ _id: oid('inv1') });
    await expect(
      service.resolveUserId(profile, 'oidc', { allowJit: true }),
    ).resolves.toBe('jit-from-invite');
    expect(accept.acceptWithSso).toHaveBeenCalledWith(
      { _id: expect.anything() },
      expect.objectContaining({ email: 'jane@acme.com', status: 'active' }),
    );
  });

  it('OIDC with allowJit and no invitation → plain JIT user', async () => {
    await expect(
      service.resolveUserId(profile, 'oidc', { allowJit: true }),
    ).resolves.toBe('created');
    expect(users.create.mock.calls[0][0]).toMatchObject({
      socialLinks: { oidc: 'g-1' },
    });
  });

  it('OIDC without allowJit → ACCOUNT_NOT_PROVISIONED', async () => {
    await expect(service.resolveUserId(profile, 'oidc')).rejects.toMatchObject({
      response: { code: 'ACCOUNT_NOT_PROVISIONED' },
    });
  });

  describe('Require SSO (Google sign-in)', () => {
    it('existing enforced member → 403 SSO_REQUIRED, Google id not linked', async () => {
      enforced = ['jane@acme.com'];
      users.findByEmailInsensitive.mockResolvedValue({
        _id: oid('u1'),
        email: 'jane@acme.com',
        status: 'active',
        socialLinks: {},
      });
      await expect(
        service.resolveUserId(profile, 'google'),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'SSO_REQUIRED' },
      });
      expect(users.updateSocialId).not.toHaveBeenCalled();
    });

    it('no account + pending invitation in an enforced domain → SSO_REQUIRED (not INVITATION_PENDING)', async () => {
      enforced = ['jane@acme.com'];
      invitations.findPendingByEmail.mockResolvedValue({
        _id: oid('inv'),
        roleId: oid('role-member'),
      });
      await expect(
        service.resolveUserId(profile, 'google'),
      ).rejects.toMatchObject({
        response: { code: 'SSO_REQUIRED' },
      });
    });

    it('no account + pending OWNER invitation → still INVITATION_PENDING (Owners exempt)', async () => {
      enforced = ['jane@acme.com'];
      invitations.findPendingByEmail.mockResolvedValue({
        _id: oid('inv'),
        roleId: oid('role-owner'),
      });
      await expect(
        service.resolveUserId(profile, 'google'),
      ).rejects.toMatchObject({
        response: { code: 'INVITATION_PENDING' },
      });
    });

    it('the OIDC path is never refused for SSO (it IS the SSO sign-in)', async () => {
      enforced = ['jane@acme.com'];
      users.findByEmailInsensitive.mockResolvedValue({
        _id: oid('u1'),
        email: 'jane@acme.com',
        status: 'active',
        socialLinks: {},
      });
      await expect(service.resolveUserId(profile, 'oidc')).resolves.toBe('u1');
    });
  });
});
