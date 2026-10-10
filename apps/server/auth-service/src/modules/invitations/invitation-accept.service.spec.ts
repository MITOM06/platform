jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('bcrypt-hash'),
}));

import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Department, Invitation, REDIS_CLIENT, Role } from '@platform/database';
import { InvitationAcceptService } from './invitation-accept.service';
import { InvitationMailerService } from './invitation-mailer.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { hashInviteToken } from './invitation-token.util';
import { SsoPolicyService, ssoRequired } from '../sso/sso-policy.service';

const ex = (v: any) => ({ exec: jest.fn().mockResolvedValue(v) });
const oid = (s: string) => ({ toString: () => s });
const DAY = 24 * 3600 * 1000;
const TOKEN = 'A'.repeat(43);
const INV_ID = '64b0000000000000000000aa';

function invDoc(over: Partial<Record<string, any>> = {}) {
  return {
    _id: oid(INV_ID),
    email: 'jane@acme.com',
    roleId: oid('role-member'),
    departmentIds: [oid('d-live'), oid('d-deleted')],
    invitedBy: 'admin1',
    status: 'pending',
    expiresAt: new Date(Date.now() + DAY),
    ...over,
  };
}

describe('InvitationAcceptService', () => {
  let service: InvitationAcceptService;
  let invitationModel: any;
  let roleModel: any;
  let departmentModel: any;
  let users: { findByEmailInsensitive: jest.Mock; create: jest.Mock };
  let audit: { record: jest.Mock };
  let redis: { set: jest.Mock; getdel: jest.Mock };
  let sso: { assertNotEnforced: jest.Mock };
  let mailer: {
    workspaceName: jest.Mock;
    inviterName: jest.Mock;
    sendWelcome: jest.Mock;
  };

  beforeEach(async () => {
    invitationModel = {
      findOne: jest.fn().mockReturnValue(ex(invDoc())),
      findById: jest.fn().mockReturnValue(ex(invDoc())),
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue(ex(invDoc({ status: 'accepted' }))),
      updateOne: jest.fn().mockReturnValue(ex({ modifiedCount: 1 })),
    };
    roleModel = {
      findById: jest
        .fn()
        .mockReturnValue(ex({ _id: oid('role-member'), name: 'Member' })),
    };
    departmentModel = {
      find: jest
        .fn()
        .mockReturnValue({ select: () => ex([{ _id: oid('d-live') }]) }),
    };
    users = {
      findByEmailInsensitive: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (d: any) => ({ _id: oid('new-user'), ...d })),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    redis = { set: jest.fn().mockResolvedValue('OK'), getdel: jest.fn() };
    sso = { assertNotEnforced: jest.fn().mockResolvedValue(undefined) };
    mailer = {
      workspaceName: jest.fn().mockResolvedValue('Acme'),
      inviterName: jest.fn().mockResolvedValue('Khang'),
      sendWelcome: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InvitationAcceptService,
        { provide: getModelToken(Invitation.name), useValue: invitationModel },
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(Department.name), useValue: departmentModel },
        { provide: UsersService, useValue: users },
        { provide: AuditService, useValue: audit },
        { provide: InvitationMailerService, useValue: mailer },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: SsoPolicyService, useValue: sso },
      ],
    }).compile();
    service = moduleRef.get(InvitationAcceptService);
  });

  describe('preview', () => {
    it('looks the invitation up by token hash and returns the public preview', async () => {
      const res = await service.preview(TOKEN);
      expect(invitationModel.findOne).toHaveBeenCalledWith({
        tokenHash: hashInviteToken(TOKEN),
      });
      expect(res).toEqual({
        email: 'jane@acme.com',
        workspaceName: 'Acme',
        inviterName: 'Khang',
        roleName: 'Member',
        expiresAt: expect.any(String),
      });
    });

    it.each([
      ['unknown token', 404, 'INVITATION_INVALID', null],
      [
        'expired',
        410,
        'INVITATION_EXPIRED',
        invDoc({ expiresAt: new Date(Date.now() - 1) }),
      ],
      ['revoked', 410, 'INVITATION_REVOKED', invDoc({ status: 'revoked' })],
      [
        'accepted',
        409,
        'INVITATION_ALREADY_ACCEPTED',
        invDoc({ status: 'accepted' }),
      ],
    ])('%s → %i %s', async (_l, status, code, doc) => {
      invitationModel.findOne.mockReturnValue(ex(doc));
      await expect(service.preview(TOKEN)).rejects.toMatchObject({
        status,
        response: { code },
      });
    });

    it('malformed token never reaches the DB', async () => {
      await expect(service.preview('../../etc')).rejects.toMatchObject({
        response: { code: 'INVITATION_INVALID' },
      });
      expect(invitationModel.findOne).not.toHaveBeenCalled();
    });
  });

  describe('acceptWithPassword', () => {
    it('creates an active verified user with the invite role + surviving departments', async () => {
      const user = await service.acceptWithPassword(TOKEN, {
        displayName: '  Jane  ',
        password: 'P@ssw0rd!',
      });

      expect(invitationModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: expect.anything(),
          status: 'pending',
          expiresAt: { $gt: expect.any(Date) },
        },
        {
          $set: expect.objectContaining({
            status: 'accepted',
            acceptedVia: 'password',
          }),
        },
        { new: true },
      );
      const created = users.create.mock.calls[0][0];
      expect(created).toMatchObject({
        email: 'jane@acme.com',
        displayName: 'Jane',
        password: 'bcrypt-hash',
        isVerified: true,
        status: 'active',
      });
      expect(created.roleId.toString()).toBe('role-member');
      expect(created.departmentIds.map(String)).toEqual(['d-live']);
      expect(invitationModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.anything() },
        { $set: { acceptedUserId: 'new-user' } },
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'new-user',
          action: 'invitation.accept',
          meta: { email: 'jane@acme.com', via: 'password' },
        }),
      );
      expect(user._id.toString()).toBe('new-user');
    });

    it('deleted role → user created without roleId (Member fallback in claims)', async () => {
      roleModel.findById.mockReturnValue(ex(null));
      await service.acceptWithPassword(TOKEN, {
        displayName: 'Jane',
        password: 'P@ssw0rd!',
      });
      expect(users.create.mock.calls[0][0]).not.toHaveProperty('roleId');
    });

    it('losing a concurrent accept → INVITATION_ALREADY_ACCEPTED', async () => {
      invitationModel.findOneAndUpdate.mockReturnValue(ex(null));
      invitationModel.findById.mockReturnValue(
        ex(invDoc({ status: 'accepted' })),
      );
      await expect(
        service.acceptWithPassword(TOKEN, {
          displayName: 'Jane',
          password: 'P@ssw0rd!',
        }),
      ).rejects.toMatchObject({
        response: { code: 'INVITATION_ALREADY_ACCEPTED' },
      });
      expect(users.create).not.toHaveBeenCalled();
    });

    it('duplicate-email race reverts the invitation to pending → MEMBER_ALREADY_EXISTS', async () => {
      users.create.mockRejectedValue({ code: 11000 });
      await expect(
        service.acceptWithPassword(TOKEN, {
          displayName: 'Jane',
          password: 'P@ssw0rd!',
        }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'MEMBER_ALREADY_EXISTS' },
      });
      expect(invitationModel.updateOne).toHaveBeenCalledWith(
        { _id: expect.anything(), status: 'accepted' },
        {
          $set: { status: 'pending' },
          $unset: { acceptedAt: '', acceptedVia: '' },
        },
      );
    });
  });

  describe('Google flow', () => {
    it('startGoogleFlow stores a short-lived flow id → invitation id', async () => {
      const flowId = await service.startGoogleFlow(TOKEN);
      expect(flowId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
      expect(flowId).not.toContain(TOKEN);
      expect(redis.set).toHaveBeenCalledWith(
        `invite_oauth:${flowId}`,
        INV_ID,
        'EX',
        600,
      );
    });

    it('acceptWithGoogle consumes the flow once and matches email case-insensitively', async () => {
      redis.getdel.mockResolvedValueOnce(INV_ID).mockResolvedValueOnce(null);
      const userId = await service.acceptWithGoogle('flow_abcdefghijklmnop', {
        id: 'g-123',
        email: 'Jane@Acme.COM',
        displayName: 'Jane G',
        avatar: 'https://img',
      });
      expect(userId).toBe('new-user');
      expect(users.create.mock.calls[0][0]).toMatchObject({
        displayName: 'Jane G',
        avatarUrl: 'https://img',
        socialLinks: { google: 'g-123' },
        status: 'active',
      });

      // Second use of the same flow id: gone.
      await expect(
        service.acceptWithGoogle('flow_abcdefghijklmnop', {
          email: 'jane@acme.com',
        }),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: 'INVITATION_INVALID' },
      });
    });

    it('email mismatch → 403 INVITATION_EMAIL_MISMATCH and the invitation stays pending', async () => {
      redis.getdel.mockResolvedValue(INV_ID);
      await expect(
        service.acceptWithGoogle('flow_abcdefghijklmnop', {
          email: 'other@acme.com',
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'INVITATION_EMAIL_MISMATCH' },
      });
      expect(invitationModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('mustSetPassword + welcome email', () => {
    const PASSWORD_DTO = { displayName: 'Jane', password: 'P@ssw0rd!' };
    const GOOGLE_PROFILE = {
      id: 'g-123',
      email: 'jane@acme.com',
      displayName: 'Jane G',
    };

    it('password accept: flag NOT set, welcome email with the password variant', async () => {
      await service.acceptWithPassword(TOKEN, PASSWORD_DTO);
      expect(users.create.mock.calls[0][0]).not.toHaveProperty(
        'mustSetPassword',
      );
      expect(mailer.sendWelcome).toHaveBeenCalledTimes(1);
      expect(mailer.sendWelcome).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@acme.com' }),
        'Jane',
        'password',
      );
    });

    it('Google accept: user created with mustSetPassword:true, welcome email with the google variant', async () => {
      redis.getdel.mockResolvedValue(INV_ID);
      await service.acceptWithGoogle('flow_abcdefghijklmnop', GOOGLE_PROFILE);
      expect(users.create.mock.calls[0][0]).toMatchObject({
        mustSetPassword: true,
      });
      expect(mailer.sendWelcome).toHaveBeenCalledTimes(1);
      expect(mailer.sendWelcome).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@acme.com' }),
        'Jane G',
        'google',
      );
    });

    it('SSO accept: no flag, no welcome email', async () => {
      await service.acceptWithSso(invDoc() as any, { displayName: 'Jane S' });
      expect(users.create.mock.calls[0][0]).not.toHaveProperty(
        'mustSetPassword',
      );
      expect(mailer.sendWelcome).not.toHaveBeenCalled();
    });

    it('a failing welcome email never fails the accept', async () => {
      mailer.sendWelcome.mockRejectedValue(new Error('smtp down'));
      await expect(
        service.acceptWithPassword(TOKEN, PASSWORD_DTO),
      ).resolves.toBeDefined();
      redis.getdel.mockResolvedValue(INV_ID);
      await expect(
        service.acceptWithGoogle('flow_abcdefghijklmnop', GOOGLE_PROFILE),
      ).resolves.toBe('new-user');
    });

    it('a hanging welcome email never delays the accept (fire-and-forget)', async () => {
      mailer.sendWelcome.mockReturnValue(new Promise(() => undefined));
      await expect(
        service.acceptWithPassword(TOKEN, PASSWORD_DTO),
      ).resolves.toBeDefined();
    });

    it('no welcome email when the accept fails', async () => {
      users.create.mockRejectedValue({ code: 11000 });
      await expect(
        service.acceptWithPassword(TOKEN, PASSWORD_DTO),
      ).rejects.toMatchObject({ response: { code: 'MEMBER_ALREADY_EXISTS' } });
      expect(mailer.sendWelcome).not.toHaveBeenCalled();
    });
  });

  describe('Require SSO (invitation for an enforced domain)', () => {
    const GOOGLE = { id: 'g1', email: 'jane@acme.com', displayName: 'Jane' };
    beforeEach(() => sso.assertNotEnforced.mockRejectedValue(ssoRequired()));

    it('accept with password → 403 SSO_REQUIRED; invitation untouched, no user', async () => {
      await expect(
        service.acceptWithPassword(TOKEN, {
          displayName: 'Jane',
          password: 'Str0ngPassw0rd',
        } as any),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'SSO_REQUIRED' },
      });
      expect(sso.assertNotEnforced).toHaveBeenCalledWith({
        email: 'jane@acme.com',
        roleId: expect.anything(),
      });
      expect(invitationModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
    });

    it('Google accept is refused at init (no flow id) and at the callback', async () => {
      await expect(service.startGoogleFlow(TOKEN)).rejects.toMatchObject({
        response: { code: 'SSO_REQUIRED' },
      });
      expect(redis.set).not.toHaveBeenCalled();

      redis.getdel.mockResolvedValue(INV_ID);
      await expect(
        service.acceptWithGoogle('flow_abcdefghijklmnop', GOOGLE),
      ).rejects.toMatchObject({ response: { code: 'SSO_REQUIRED' } });
      expect(users.create).not.toHaveBeenCalled();
    });

    it('the SSO sign-in still consumes the invitation (acceptWithSso is not checked)', async () => {
      await expect(
        service.acceptWithSso(invDoc() as any, { displayName: 'Jane' }),
      ).resolves.toBeDefined();
      expect(users.create).toHaveBeenCalled();
    });
  });
});
