import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  Department,
  Invitation,
  INVITATION_TTL_MS,
  REDIS_CLIENT,
  Role,
} from '@platform/database';
import { InvitationsService } from './invitations.service';
import { InvitationMailerService } from './invitation-mailer.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { hashInviteToken } from './invitation-token.util';

const ex = (v: any) => ({ exec: jest.fn().mockResolvedValue(v) });
const oid = (s: string) => ({ toString: () => s });

const MEMBER = { _id: oid('role-member'), name: 'Member' };
const OWNER = { _id: oid('role-owner'), name: 'Owner' };
const DAY = 24 * 3600 * 1000;

function invDoc(over: Partial<Record<string, any>> = {}) {
  const now = Date.now();
  return {
    _id: oid('inv1'),
    email: 'jane@acme.com',
    roleId: oid('role-member'),
    departmentIds: [],
    invitedBy: 'admin1',
    tokenHash: 'h',
    status: 'pending',
    expiresAt: new Date(now + DAY),
    createdAt: new Date(now),
    lastSentAt: new Date(now),
    sendCount: 1,
    locale: 'en',
    ...over,
  };
}

describe('InvitationsService (admin)', () => {
  let service: InvitationsService;
  let invitationModel: any;
  let roleModel: any;
  let departmentModel: any;
  let users: { findByEmailInsensitive: jest.Mock; findManyByIds: jest.Mock };
  let audit: { record: jest.Mock };
  let mailer: { send: jest.Mock; workspaceName: jest.Mock };
  let redis: { set: jest.Mock; ttl: jest.Mock };

  const admin = { sub: 'admin1', role: 'Admin' };

  beforeEach(async () => {
    invitationModel = {
      findOne: jest.fn().mockReturnValue(ex(null)),
      create: jest.fn(async (d: any) => ({
        _id: oid('inv-new'),
        createdAt: new Date(),
        ...d,
      })),
      find: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn().mockReturnValue(ex({ modifiedCount: 1 })),
      updateMany: jest.fn().mockReturnValue(ex({ modifiedCount: 0 })),
    };
    roleModel = {
      findById: jest.fn().mockReturnValue(ex(MEMBER)),
      findOne: jest.fn((q: any) => ex(q.name === 'Owner' ? OWNER : MEMBER)),
      find: jest.fn().mockReturnValue(ex([MEMBER, OWNER])),
    };
    departmentModel = { countDocuments: jest.fn().mockReturnValue(ex(0)) };
    users = {
      findByEmailInsensitive: jest.fn().mockResolvedValue(null),
      findManyByIds: jest
        .fn()
        .mockResolvedValue([{ _id: oid('admin1'), displayName: 'Khang' }]),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    mailer = {
      send: jest.fn().mockResolvedValue(true),
      workspaceName: jest.fn().mockResolvedValue('Acme'),
    };
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      ttl: jest.fn().mockResolvedValue(42),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: getModelToken(Invitation.name), useValue: invitationModel },
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(Department.name), useValue: departmentModel },
        { provide: UsersService, useValue: users },
        { provide: AuditService, useValue: audit },
        { provide: InvitationMailerService, useValue: mailer },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = moduleRef.get(InvitationsService);
  });

  describe('create', () => {
    it('lowercases the email, defaults to Member, stores only the token hash', async () => {
      const res = await service.create(
        admin,
        { email: '  Jane@ACME.com ' },
        'vi',
      );

      const stored = invitationModel.create.mock.calls[0][0];
      expect(stored.email).toBe('jane@acme.com');
      expect(stored.roleId).toBe(MEMBER._id);
      expect(stored.locale).toBe('vi');
      expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(stored).not.toHaveProperty('token');
      // The raw token reaches only the mailer; its hash is what is stored.
      const rawToken = mailer.send.mock.calls[0][1];
      expect(hashInviteToken(rawToken)).toBe(stored.tokenHash);
      expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(
        INVITATION_TTL_MS - 5000,
      );

      expect(res.emailSent).toBe(true);
      expect(res.invitation).toMatchObject({
        email: 'jane@acme.com',
        roleName: 'Member',
        status: 'pending',
        invitedBy: { id: 'admin1', displayName: 'Khang' },
      });
      expect(JSON.stringify(res)).not.toContain(rawToken);
      expect(JSON.stringify(res)).not.toContain(stored.tokenHash);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'invitation.create',
          targetType: 'invitation',
        }),
      );
    });

    it('409 MEMBER_ALREADY_EXISTS when a user has that email', async () => {
      users.findByEmailInsensitive.mockResolvedValue({ _id: 'u1' });
      await expect(
        service.create(admin, { email: 'jane@acme.com' }, 'en'),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'MEMBER_ALREADY_EXISTS' },
      });
    });

    it('409 INVITATION_ALREADY_PENDING for a live pending invite', async () => {
      invitationModel.findOne.mockReturnValue(ex(invDoc()));
      await expect(
        service.create(admin, { email: 'jane@acme.com' }, 'en'),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'INVITATION_ALREADY_PENDING' },
      });
      expect(invitationModel.create).not.toHaveBeenCalled();
    });

    it('auto-revokes an expired pending invite and creates a new one', async () => {
      invitationModel.findOne.mockReturnValue(
        ex(invDoc({ expiresAt: new Date(Date.now() - 1000) })),
      );
      await service.create(admin, { email: 'jane@acme.com' }, 'en');
      expect(invitationModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
        { $set: expect.objectContaining({ status: 'revoked' }) },
      );
      expect(invitationModel.create).toHaveBeenCalled();
    });

    it('400 ROLE_NOT_FOUND / DEPARTMENT_NOT_FOUND', async () => {
      roleModel.findById.mockReturnValue(ex(null));
      await expect(
        service.create(
          admin,
          { email: 'a@b.co', roleId: '64b000000000000000000001' },
          'en',
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'ROLE_NOT_FOUND' },
      });

      roleModel.findById.mockReturnValue(ex(MEMBER));
      departmentModel.countDocuments.mockReturnValue(ex(1));
      await expect(
        service.create(
          admin,
          {
            email: 'a@b.co',
            departmentIds: [
              '64b000000000000000000002',
              '64b000000000000000000003',
            ],
          },
          'en',
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'DEPARTMENT_NOT_FOUND' },
      });
    });

    it('403 OWNER_ROLE_ASSIGN_FORBIDDEN when a non-Owner grants Owner; Owner may', async () => {
      roleModel.findById.mockReturnValue(ex(OWNER));
      await expect(
        service.create(
          admin,
          { email: 'a@b.co', roleId: '64b000000000000000000001' },
          'en',
        ),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'OWNER_ROLE_ASSIGN_FORBIDDEN' },
      });

      await expect(
        service.create(
          { sub: 'o1', role: 'Owner' },
          { email: 'a@b.co', roleId: '64b000000000000000000001' },
          'en',
        ),
      ).resolves.toMatchObject({ emailSent: true });
    });

    it('403 ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS when a non-Owner invites into a role above them', async () => {
      const superRole = {
        _id: oid('role-super'),
        name: 'Owner copy',
        permissions: { MANAGE_WORKSPACE: true, MANAGE_MEMBERS: true },
      };
      roleModel.findById.mockReturnValue(ex(superRole));
      const narrowAdmin = { sub: 'admin1', role: 'Admin', perms: ['MANAGE_MEMBERS'] };
      await expect(
        service.create(
          narrowAdmin,
          { email: 'a@b.co', roleId: '64b000000000000000000009' },
          'en',
        ),
      ).rejects.toMatchObject({
        status: 403,
        response: {
          code: 'ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS',
          params: { capabilities: ['MANAGE_WORKSPACE'] },
        },
      });
      expect(invitationModel.create).not.toHaveBeenCalled();

      // Inside the actor's capabilities → allowed; the Owner is exempt.
      await expect(
        service.create(
          { ...narrowAdmin, perms: ['MANAGE_MEMBERS', 'MANAGE_WORKSPACE'] },
          { email: 'a@b.co', roleId: '64b000000000000000000009' },
          'en',
        ),
      ).resolves.toMatchObject({ emailSent: true });
      await expect(
        service.create(
          { sub: 'o1', role: 'Owner', perms: [] },
          { email: 'c@b.co', roleId: '64b000000000000000000009' },
          'en',
        ),
      ).resolves.toMatchObject({ emailSent: true });
    });

    it('mail failure keeps the invitation and reports emailSent:false', async () => {
      mailer.send.mockResolvedValue(false);
      const res = await service.create(admin, { email: 'a@b.co' }, 'en');
      expect(res.emailSent).toBe(false);
      expect(invitationModel.create).toHaveBeenCalled();
      expect(audit.record.mock.calls[0][0].meta.emailSent).toBe(false);
    });

    it('maps a duplicate-key race to INVITATION_ALREADY_PENDING', async () => {
      invitationModel.create.mockRejectedValue({ code: 11000 });
      await expect(
        service.create(admin, { email: 'a@b.co' }, 'en'),
      ).rejects.toMatchObject({
        response: { code: 'INVITATION_ALREADY_PENDING' },
      });
    });
  });

  describe('list', () => {
    const sorted = (docs: any[]) => ({
      sort: () => ({ limit: () => ex(docs) }),
    });

    it('defaults to pending (incl. expired) and derives "expired"', async () => {
      invitationModel.find.mockReturnValue(
        sorted([
          invDoc(),
          invDoc({ _id: oid('inv2'), expiresAt: new Date(Date.now() - 1000) }),
        ]),
      );
      const views = await service.list();
      expect(invitationModel.find).toHaveBeenCalledWith({ status: 'pending' });
      expect(views.map((v) => v.status)).toEqual(['pending', 'expired']);
    });

    it('status=expired filters on expiresAt < now; system inviter → workspace name', async () => {
      invitationModel.find.mockReturnValue(
        sorted([
          invDoc({
            invitedBy: 'system',
            expiresAt: new Date(Date.now() - 1000),
          }),
        ]),
      );
      const [view] = await service.list('expired');
      expect(invitationModel.find.mock.calls[0][0]).toMatchObject({
        status: 'pending',
        expiresAt: { $lt: expect.any(Date) },
      });
      expect(view.invitedBy).toEqual({ id: 'system', displayName: 'Acme' });
    });
  });

  describe('resend', () => {
    const ID = '64b0000000000000000000aa';

    it('rotates the token hash + expiry, bumps sendCount, mails the new token', async () => {
      invitationModel.findById.mockReturnValue(ex(invDoc({ _id: oid(ID) })));
      invitationModel.findOneAndUpdate.mockImplementation((_f: any, upd: any) =>
        ex(invDoc({ _id: oid(ID), ...upd.$set, sendCount: 2 })),
      );

      const res = await service.resend(admin, ID);

      const upd = invitationModel.findOneAndUpdate.mock.calls[0][1];
      expect(upd.$inc).toEqual({ sendCount: 1 });
      expect(upd.$set.tokenHash).not.toBe('h');
      expect(hashInviteToken(mailer.send.mock.calls[0][1])).toBe(
        upd.$set.tokenHash,
      );
      expect(redis.set).toHaveBeenCalledWith(
        `invite_resend_cooldown:${ID}`,
        '1',
        'EX',
        60,
        'NX',
      );
      expect(res.invitation.sendCount).toBe(2);
    });

    it('429 INVITATION_RESEND_COOLDOWN with ttl', async () => {
      invitationModel.findById.mockReturnValue(ex(invDoc({ _id: oid(ID) })));
      redis.set.mockResolvedValue(null);
      await expect(service.resend(admin, ID)).rejects.toMatchObject({
        status: 429,
        response: { code: 'INVITATION_RESEND_COOLDOWN', params: { ttl: 42 } },
      });
    });

    it('409 INVITATION_NOT_PENDING for accepted/revoked; 404 for unknown', async () => {
      invitationModel.findById.mockReturnValue(
        ex(invDoc({ status: 'accepted' })),
      );
      await expect(service.resend(admin, ID)).rejects.toMatchObject({
        status: 409,
        response: { code: 'INVITATION_NOT_PENDING' },
      });
      invitationModel.findById.mockReturnValue(ex(null));
      await expect(service.resend(admin, ID)).rejects.toMatchObject({
        status: 404,
        response: { code: 'INVITATION_NOT_FOUND' },
      });
      await expect(service.resend(admin, 'garbage')).rejects.toMatchObject({
        response: { code: 'INVITATION_NOT_FOUND' },
      });
    });

    it('auto-revokes and 409s when the invitee already has an account', async () => {
      invitationModel.findById.mockReturnValue(ex(invDoc({ _id: oid(ID) })));
      users.findByEmailInsensitive.mockResolvedValue({ _id: 'u1' });
      await expect(service.resend(admin, ID)).rejects.toMatchObject({
        response: { code: 'MEMBER_ALREADY_EXISTS' },
      });
      expect(invitationModel.updateOne).toHaveBeenCalled();
      expect(mailer.send).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    const ID = '64b0000000000000000000aa';

    it('revokes a pending invitation and audits', async () => {
      invitationModel.findById.mockReturnValue(ex(invDoc({ _id: oid(ID) })));
      await expect(service.revoke(admin, ID)).resolves.toEqual({
        success: true,
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'invitation.revoke' }),
      );
    });

    it('409 INVITATION_NOT_PENDING when already accepted/revoked', async () => {
      invitationModel.findById.mockReturnValue(
        ex(invDoc({ status: 'revoked' })),
      );
      invitationModel.updateOne.mockReturnValue(ex({ modifiedCount: 0 }));
      await expect(service.revoke(admin, ID)).rejects.toMatchObject({
        status: 409,
        response: { code: 'INVITATION_NOT_PENDING' },
      });
    });
  });

  describe('createBootstrapOwnerInvite', () => {
    it('creates a system Owner invitation when nobody has the email', async () => {
      await service.createBootstrapOwnerInvite('Boss@Acme.com');
      const stored = invitationModel.create.mock.calls[0][0];
      expect(stored).toMatchObject({
        email: 'boss@acme.com',
        invitedBy: 'system',
        roleId: OWNER._id,
      });
      expect(mailer.send).toHaveBeenCalled();
    });

    it('is a no-op when a user or a live pending invite exists', async () => {
      users.findByEmailInsensitive.mockResolvedValueOnce({ _id: 'u1' });
      await service.createBootstrapOwnerInvite('boss@acme.com');
      invitationModel.findOne.mockReturnValue(ex(invDoc()));
      await service.createBootstrapOwnerInvite('boss@acme.com');
      expect(invitationModel.create).not.toHaveBeenCalled();
    });
  });
});
