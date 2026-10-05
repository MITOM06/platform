jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('new-hash'),
}));

import * as bcrypt from 'bcrypt';
import { PasswordChangeService } from './password-change.service';

function make(user: any) {
  const userModel = {
    findById: jest.fn().mockReturnValue({
      select: () => ({ exec: jest.fn().mockResolvedValue(user) }),
    }),
  };
  const users = { updatePassword: jest.fn().mockResolvedValue(undefined) };
  const session = {
    revokeOtherSessions: jest.fn().mockResolvedValue(2),
    revokeAllSessions: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PasswordChangeService(
    userModel as any,
    users as any,
    session as any,
  );
  return { service, users, session };
}

describe('PasswordChangeService.changePassword', () => {
  beforeEach(() => (bcrypt.compare as jest.Mock).mockReset());

  it('signs out every OTHER session after a successful change (E2E: other session stayed 200)', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const { service, users, session } = make({ _id: 'u1', password: 'old' });

    await expect(
      service.changePassword(
        'u1',
        'sid-current',
        'old-password',
        'new-password-1',
      ),
    ).resolves.toEqual({ success: true });

    expect(users.updatePassword).toHaveBeenCalledWith('u1', 'new-hash');
    expect(session.revokeOtherSessions).toHaveBeenCalledWith(
      'u1',
      'sid-current',
    );
    expect(session.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('sets a first password for a Google-only account without asking for a current one', async () => {
    const { service, users } = make({ _id: 'u1', password: undefined });
    await service.changePassword('u1', 'sid', undefined, 'new-password-1');
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(users.updatePassword).toHaveBeenCalled();
  });

  it('typed 409 errors keep the legacy English message (shipped clients match it)', async () => {
    const { service, users, session } = make({ _id: 'u1', password: 'old' });

    await expect(
      service.changePassword('u1', 'sid', undefined, 'new-password-1'),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        statusCode: 409,
        code: 'CURRENT_PASSWORD_REQUIRED',
        message: 'Current password is required',
      },
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      service.changePassword('u1', 'sid', 'wrong', 'new-password-1'),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'CURRENT_PASSWORD_INCORRECT',
        message: 'Incorrect current password',
      },
    });

    expect(users.updatePassword).not.toHaveBeenCalled();
    expect(session.revokeOtherSessions).not.toHaveBeenCalled();
  });

  it('enforces the same 8-character minimum as invitation accept', async () => {
    const { service, users } = make({ _id: 'u1', password: 'old' });
    for (const pw of [undefined, '', '1234567']) {
      await expect(
        service.changePassword('u1', 'sid', 'old', pw),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'VAL_PASSWORD_TOO_SHORT', params: { min: 8 } },
      });
    }
    expect(users.updatePassword).not.toHaveBeenCalled();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await expect(
      service.changePassword('u1', 'sid', 'old', '12345678'),
    ).resolves.toEqual({
      success: true,
    });
  });

  it('unknown user → 409 USER_NOT_FOUND (legacy message kept)', async () => {
    const { service } = make(null);
    await expect(
      service.changePassword('u1', 'sid', 'x', 'new-password-1'),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'USER_NOT_FOUND', message: 'User not found' },
    });
  });
});
