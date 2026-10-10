// nanoid is ESM-only (pulled in via PasswordChangeService → SessionService).
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { ValidationPipe } from '@nestjs/common';
import { UsersController } from './users.controller';
import { ChangePasswordDto } from './dto/change-password.dto';

describe('UsersController — /me (2FA, roleName) and change-password body', () => {
  let users: Record<string, jest.Mock>;
  let passwordChange: { changePassword: jest.Mock };
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
    };
    passwordChange = { changePassword: jest.fn().mockResolvedValue({ success: true }) };
    controller = new UsersController(
      users as any,
      passwordChange as any,
      {} as any,
      {
        isEnforcedFor: jest.fn().mockResolvedValue(false),
        assertNotEnforcedForUserId: jest.fn().mockResolvedValue(undefined),
      } as any,
    );
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

    it('2FA flags: mfaEnabled from the enrollment, mfaRequired from the role claims; no raw mfa', async () => {
      users.findById.mockResolvedValue(
        doc({ mfa: { enabled: true, enrolledAt: new Date() } }),
      );
      const me = await controller.getMe({
        user: { sub: 'u1', role: 'Admin', perms: ['MANAGE_MEMBERS'] },
      });
      expect(me).toMatchObject({ mfaEnabled: true, mfaRequired: true });
      expect(me).not.toHaveProperty('mfa');
    });

    it('Member, never enrolled → mfaEnabled:false, mfaRequired:false', async () => {
      users.findById.mockResolvedValue(doc());
      const me = await controller.getMe({
        user: { sub: 'u1', role: 'Member', perms: ['USE_GROUP_BOT'] },
      });
      expect(me).toMatchObject({ mfaEnabled: false, mfaRequired: false });
    });

    it('custom role with MANAGE_ROLES → mfaRequired:true (not enrolled yet)', async () => {
      users.findById.mockResolvedValue(doc());
      const me = await controller.getMe({
        user: { sub: 'u1', role: 'Ops lead', perms: ['MANAGE_ROLES'] },
      });
      expect(me).toMatchObject({ mfaEnabled: false, mfaRequired: true });
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
      await controller.changePassword({ user: { sub: 'u1', sid: 's1' } }, dto);
      expect(passwordChange.changePassword).toHaveBeenCalledWith('u1', 's1', 'a', 'b');
    });
  });
});
