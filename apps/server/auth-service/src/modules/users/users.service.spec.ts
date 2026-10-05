jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('new-hash'),
}));

import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

const ex = (v: unknown) => ({ exec: jest.fn().mockResolvedValue(v) });

describe('UsersService — change / first-set password', () => {
  let userModel: { findById: jest.Mock; findByIdAndUpdate: jest.Mock };
  let service: UsersService;

  const withPassword = { _id: 'u1', password: 'old-hash' };
  const googleOnly = { _id: 'u1', password: undefined, mustSetPassword: true };

  const stubUser = (user: unknown) =>
    userModel.findById.mockReturnValue({ select: () => ex(user) });

  beforeEach(() => {
    userModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    stubUser(withPassword);
    (bcrypt.compare as jest.Mock).mockReset().mockResolvedValue(true);
    service = new UsersService(userModel as any, {} as any, {} as any);
  });

  it.each([
    ['5 characters', '12345'],
    ['7 characters', '1234567'],
    ['missing', undefined],
    ['not a string', 12345678],
  ])(
    'newPassword %s → 400 VAL_PASSWORD_TOO_SHORT, nothing read or written',
    async (_l, newPassword) => {
      await expect(
        service.changePassword('u1', 'old', newPassword),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'VAL_PASSWORD_TOO_SHORT' },
      });
      expect(userModel.findById).not.toHaveBeenCalled();
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('unknown user → 404 USER_NOT_FOUND', async () => {
    stubUser(null);
    await expect(
      service.changePassword('u1', 'old', 'N3wPassw0rd'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'USER_NOT_FOUND' },
    });
  });

  it('malformed user id → 404 USER_NOT_FOUND (not a 500)', async () => {
    userModel.findById.mockReturnValue({
      select: () => ({
        exec: jest
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('x'), { name: 'CastError' }),
          ),
      }),
    });
    await expect(
      service.changePassword('bad', 'old', 'N3wPassw0rd'),
    ).rejects.toMatchObject({ response: { code: 'USER_NOT_FOUND' } });
  });

  it.each([undefined, ''])(
    'has a password + currentPassword %p → 400 CURRENT_PASSWORD_REQUIRED',
    async (current) => {
      await expect(
        service.changePassword('u1', current, 'N3wPassw0rd'),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'CURRENT_PASSWORD_REQUIRED' },
      });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('wrong current password → 400 CURRENT_PASSWORD_INCORRECT', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      service.changePassword('u1', 'wrong', 'N3wPassw0rd'),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'CURRENT_PASSWORD_INCORRECT' },
    });
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('correct current password → saved and mustSetPassword cleared', async () => {
    await expect(
      service.changePassword('u1', 'old', 'N3wPassw0rd'),
    ).resolves.toEqual({ success: true });
    expect(bcrypt.compare).toHaveBeenCalledWith('old', 'old-hash');
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('u1', {
      $set: { password: 'new-hash', mustSetPassword: false },
      $unset: { otpCode: '', otpExpires: '' },
    });
  });

  it('Google invitee (no password): first password set without currentPassword, flag cleared', async () => {
    stubUser(googleOnly);
    await expect(
      service.changePassword('u1', undefined, '12345678'),
    ).resolves.toEqual({ success: true });
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('u1', {
      $set: { password: 'new-hash', mustSetPassword: false },
      $unset: { otpCode: '', otpExpires: '' },
    });
  });

  it('updatePassword (also the reset-password write) always clears mustSetPassword', async () => {
    await service.updatePassword('u1', 'h');
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith('u1', {
      $set: { password: 'h', mustSetPassword: false },
      $unset: { otpCode: '', otpExpires: '' },
    });
  });
});

describe('UsersService.getRoleName', () => {
  const ROLE_ID = '64b000000000000000000001';
  const roleModel = { findById: jest.fn() };
  const service = new UsersService({} as any, {} as any, {} as any, roleModel as any);
  const stubRole = (role: unknown) =>
    roleModel.findById.mockReturnValue({
      select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(role) }) }),
    });

  beforeEach(() => roleModel.findById.mockReset());

  it('returns the role name for an assigned role', async () => {
    stubRole({ name: 'Owner' });
    await expect(service.getRoleName(ROLE_ID)).resolves.toBe('Owner');
    expect(roleModel.findById).toHaveBeenCalledWith(ROLE_ID);
  });

  it.each([
    ['no role', undefined],
    ['a malformed id', 'not-an-id'],
  ])('falls back to Member for %s without querying', async (_l, roleId) => {
    await expect(service.getRoleName(roleId)).resolves.toBe('Member');
    expect(roleModel.findById).not.toHaveBeenCalled();
  });

  it('falls back to Member when the role was deleted', async () => {
    stubRole(null);
    await expect(service.getRoleName(ROLE_ID)).resolves.toBe('Member');
  });
});
