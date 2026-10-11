jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { MfaSelfController } from './mfa-account.controller';

describe('MfaSelfController (Settings 2FA)', () => {
  const user = { sub: 'u1', sid: 's1' } as never;
  let self: Record<string, jest.Mock>;
  let controller: MfaSelfController;

  beforeEach(() => {
    self = {
      enrollStart: jest.fn().mockResolvedValue({ secret: 'S' }),
      enrollConfirm: jest
        .fn()
        .mockResolvedValue({ backupCodes: ['AAAAA-BBBBB'] }),
      disable: jest.fn().mockResolvedValue({ success: true }),
    };
    controller = new MfaSelfController({} as never, self as never);
  });

  it('enroll/start → the caller (JWT sub) only', async () => {
    await expect(controller.enrollStart(user)).resolves.toEqual({
      secret: 'S',
    });
    expect(self.enrollStart).toHaveBeenCalledWith('u1');
  });

  it('enroll/confirm → { code: MFA_BACKUP_CODES_ISSUED, backupCodes }', async () => {
    await expect(
      controller.enrollConfirm(user, { code: '123456' }),
    ).resolves.toEqual({
      code: 'MFA_BACKUP_CODES_ISSUED',
      backupCodes: ['AAAAA-BBBBB'],
    });
    expect(self.enrollConfirm).toHaveBeenCalledWith('u1', '123456');
  });

  it('disable → passes only code / backupCode', async () => {
    await expect(
      controller.disable(user, {
        backupCode: 'AAAAA-BBBBB',
        extra: 1,
      } as never),
    ).resolves.toEqual({ success: true });
    expect(self.disable).toHaveBeenCalledWith('u1', {
      code: undefined,
      backupCode: 'AAAAA-BBBBB',
    });
  });
});
