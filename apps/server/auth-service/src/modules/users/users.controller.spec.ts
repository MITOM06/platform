// nanoid is ESM-only (pulled in via PasswordChangeService → SessionService).
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { UsersController } from './users.controller';

describe('UsersController — device tokens & change-password wiring', () => {
  function make() {
    const usersService = {
      addDeviceToken: jest.fn().mockResolvedValue(undefined),
      removeDeviceToken: jest.fn().mockResolvedValue(undefined),
    };
    const passwordChange = {
      changePassword: jest.fn().mockResolvedValue({ success: true }),
    };
    const ctrl = new UsersController(
      usersService as any,
      passwordChange as any,
      {} as any,
    );
    return { ctrl, usersService, passwordChange };
  }
  const req = { user: { sub: 'u1', sid: 's1' } };

  it('DELETE /api/users/device-tokens takes the token from the body…', async () => {
    const { ctrl, usersService } = make();
    await expect(
      ctrl.removeDeviceToken(req, 'fcm-1', undefined),
    ).resolves.toEqual({
      success: true,
    });
    expect(usersService.removeDeviceToken).toHaveBeenCalledWith('u1', 'fcm-1');
  });

  it('…or from ?token= for clients that cannot send a DELETE body', async () => {
    const { ctrl, usersService } = make();
    await ctrl.removeDeviceToken(req, undefined, 'fcm-2');
    expect(usersService.removeDeviceToken).toHaveBeenCalledWith('u1', 'fcm-2');
  });

  it('400 DEVICE_TOKEN_REQUIRED when neither is a non-empty string', async () => {
    const { ctrl, usersService } = make();
    for (const [body, query] of [
      [undefined, undefined],
      ['  ', ''],
      [{ $ne: null }, ['x']],
    ] as Array<[unknown, unknown]>) {
      await expect(
        ctrl.removeDeviceToken(req, body, query),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'DEVICE_TOKEN_REQUIRED' },
      });
    }
    expect(usersService.removeDeviceToken).not.toHaveBeenCalled();
  });

  it("change-password passes the caller's sid so only OTHER sessions are revoked", async () => {
    const { ctrl, passwordChange } = make();
    await ctrl.changePassword(req, { currentPassword: 'a', newPassword: 'b' });
    expect(passwordChange.changePassword).toHaveBeenCalledWith(
      'u1',
      's1',
      'a',
      'b',
    );
  });
});
