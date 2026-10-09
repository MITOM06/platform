import { ValidationPipe } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ssoRequired } from '../sso/sso-policy.service';

describe('UsersController', () => {
  let users: Record<string, jest.Mock>;
  let sso: { isEnforcedFor: jest.Mock; assertNotEnforcedForUserId: jest.Mock };
  let controller: UsersController;

  const doc = (over: Record<string, unknown> = {}) => ({
    toObject: () => ({
      _id: 'u1',
      email: 'jane@acme.com',
      displayName: 'Jane',
      roleId: { name: 'Admin' },
      ...over,
    }),
  });

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      getHasPassword: jest.fn().mockResolvedValue(false),
      getRoleName: jest.fn().mockResolvedValue('Admin'),
      changePassword: jest.fn().mockResolvedValue({ success: true }),
    };
    sso = {
      isEnforcedFor: jest.fn().mockResolvedValue(false),
      assertNotEnforcedForUserId: jest.fn().mockResolvedValue(undefined),
    };
    controller = new UsersController(users as any, {} as any, sso as any);
  });

  describe('GET /api/users/me', () => {
    it('exposes mustSetPassword next to hasPassword', async () => {
      users.findById.mockResolvedValue(doc({ mustSetPassword: true }));
      const me = await controller.getMe({ user: { sub: 'u1' } });
      expect(me).toMatchObject({
        hasPassword: false,
        mustSetPassword: true,
        roleName: 'Admin',
      });
    });

    it('legacy document without the field → mustSetPassword:false', async () => {
      users.findById.mockResolvedValue(doc());
      users.getHasPassword.mockResolvedValue(true);
      const me = await controller.getMe({ user: { sub: 'u1' } });
      expect(me).toMatchObject({ hasPassword: true, mustSetPassword: false });
    });

    it('roleName is the resolved role name, looked up from roleId', async () => {
      users.findById.mockResolvedValue(doc({ roleId: 'r-owner' }));
      users.getRoleName.mockResolvedValue('Owner');
      const me = await controller.getMe({ user: { sub: 'u1' } });
      expect(users.getRoleName).toHaveBeenCalledWith('r-owner');
      expect(me).toMatchObject({ roleName: 'Owner' });
    });

    it('Admin, enrolled: mfaEnabled + mfaRequired + mfaAvailable; no raw mfa', async () => {
      users.findById.mockResolvedValue(
        doc({ mfa: { enabled: true, enrolledAt: new Date() } }),
      );
      const me = await controller.getMe({
        user: { sub: 'u1', role: 'Admin', perms: ['MANAGE_MEMBERS'] },
      });
      expect(me).toMatchObject({
        mfaEnabled: true,
        mfaRequired: true,
        mfaAvailable: true,
      });
      expect(me).not.toHaveProperty('mfa');
    });

    it.each([
      ['Owner', []],
      ['a custom role with MANAGE_ROLES', ['MANAGE_ROLES']],
    ])('%s, not enrolled → mfaRequired:true', async (role, perms) => {
      users.findById.mockResolvedValue(doc());
      const me = await controller.getMe({ user: { sub: 'u1', role, perms } });
      expect(me).toMatchObject({
        mfaEnabled: false,
        mfaRequired: true,
        mfaAvailable: true,
      });
    });

    it('Member, never enrolled → optional: mfaRequired:false, mfaAvailable:true', async () => {
      users.findById.mockResolvedValue(doc());
      const me = await controller.getMe({
        user: { sub: 'u1', role: 'Member', perms: ['USE_GROUP_BOT'] },
      });
      expect(me).toMatchObject({
        mfaEnabled: false,
        mfaRequired: false,
        mfaAvailable: true,
      });
    });

    it('Member who turned 2FA on → mfaEnabled:true, still optional', async () => {
      users.findById.mockResolvedValue(doc({ mfa: { enabled: true } }));
      const me = await controller.getMe({
        user: { sub: 'u1', role: 'Member', perms: ['USE_GROUP_BOT'] },
      });
      expect(me).toMatchObject({
        mfaEnabled: true,
        mfaRequired: false,
        mfaAvailable: true,
      });
    });

    it('legacy token without role claims → treated as a Member', async () => {
      users.findById.mockResolvedValue(doc());
      const me = await controller.getMe({ user: { sub: 'u1' } });
      expect(me).toMatchObject({ mfaRequired: false, mfaAvailable: true });
    });

    it('covered by Require SSO (even an Admin) → no PON 2FA at all, no set-password gate', async () => {
      users.findById.mockResolvedValue(doc({ mustSetPassword: true }));
      sso.isEnforcedFor.mockResolvedValue(true);
      const me = await controller.getMe({
        user: { sub: 'u1', role: 'Admin', perms: ['MANAGE_MEMBERS'] },
      });
      expect(sso.isEnforcedFor).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@acme.com' }),
      );
      expect(me).toMatchObject({
        mfaRequired: false,
        mfaAvailable: false,
        mustSetPassword: false,
      });
    });

    it('a bot account → mfaRequired:false, mfaAvailable:false', async () => {
      users.findById.mockResolvedValue(doc({ isBot: true }));
      const me = await controller.getMe({
        user: { sub: 'u1', role: 'Admin', perms: ['MANAGE_MEMBERS'] },
      });
      expect(me).toMatchObject({ mfaRequired: false, mfaAvailable: false });
    });
  });

  describe('POST /api/users/me/change-password body', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const validate = (body: unknown) =>
      pipe.transform(body, { type: 'body', metatype: ChangePasswordDto });

    it('a short password passes the pipe so the service answers a typed code', async () => {
      await expect(validate({ newPassword: '12345' })).resolves.toMatchObject({
        newPassword: '12345',
      });
    });

    it('keeps currentPassword + newPassword', async () => {
      const dto = await validate({ currentPassword: 'a', newPassword: 'b' });
      await controller.changePassword({ user: { sub: 'u1' } }, dto);
      expect(users.changePassword).toHaveBeenCalledWith('u1', 'a', 'b');
    });

    it('Require SSO: 403 SSO_REQUIRED before anything is checked or written', async () => {
      sso.assertNotEnforcedForUserId.mockRejectedValue(ssoRequired());
      await expect(
        controller.changePassword({ user: { sub: 'u1' } }, {
          newPassword: 'N3wPassw0rd',
        } as ChangePasswordDto),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'SSO_REQUIRED' },
      });
      expect(sso.assertNotEnforcedForUserId).toHaveBeenCalledWith('u1');
      expect(users.changePassword).not.toHaveBeenCalled();
    });
  });
});
