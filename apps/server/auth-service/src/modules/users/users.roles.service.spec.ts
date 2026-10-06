import { UsersService } from './users.service';

describe('UsersService.updatePassword', () => {
  it('(change, first set and reset) always clears mustSetPassword', async () => {
    const userModel = { findByIdAndUpdate: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(userModel as any, {} as any, {} as any, {} as any);
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
  const service = new UsersService({} as any, {} as any, {} as any, {} as any, roleModel as any);
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
