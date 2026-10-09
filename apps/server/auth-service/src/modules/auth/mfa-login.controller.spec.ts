jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { FakeRedis } from '../mfa/fake-redis.spec-helper';
import { createFakeUserModel } from '../mfa/fake-user-model.spec-helper';
import { MfaCodeService } from '../mfa/mfa-code.service';
import { MfaCryptoService } from '../mfa/mfa-crypto.service';
import { MfaPendingStore } from '../mfa/mfa-pending.store';
import { MfaService } from '../mfa/mfa.service';
import { MfaLoginController } from './mfa-login.controller';

describe('MfaLoginController (/auth/mfa/*)', () => {
  const user = { _id: 'u1', email: 'jane@acme.com', displayName: 'Jane' };
  const tokens = {
    accessToken: 'jwt',
    refreshToken: 'r1',
    sid: 's1',
    user: {
      id: 'u1',
      email: 'jane@acme.com',
      displayName: 'Jane',
      mustSetPassword: false,
    },
  };
  let mfa: Record<string, jest.Mock>;
  let auth: { issueTokensForUser: jest.Mock };
  let controller: MfaLoginController;

  beforeEach(() => {
    mfa = {
      enrollStart: jest.fn().mockResolvedValue({
        otpauthUrl: 'otpauth://x',
        secret: 'S',
        qrDataUrl: 'data:',
      }),
      enrollConfirm: jest
        .fn()
        .mockResolvedValue({ backupCodes: ['AAAAA-BBBBB'] }),
      enrollCodes: jest
        .fn()
        .mockResolvedValue({ backupCodes: ['AAAAA-BBBBB'] }),
      enrollComplete: jest
        .fn()
        .mockResolvedValue({ user, deviceId: 'd', platform: 'mobile' }),
      verify: jest.fn().mockResolvedValue({
        user,
        deviceId: 'web-login',
        platform: 'web',
        backupCodesRemaining: 7,
      }),
    };
    auth = { issueTokensForUser: jest.fn().mockResolvedValue(tokens) };
    controller = new MfaLoginController(mfa as never, auth as never);
  });

  it('enroll/start passes the token through', async () => {
    await expect(
      controller.enrollStart({ mfaToken: 't' }),
    ).resolves.toMatchObject({ secret: 'S' });
    expect(mfa.enrollStart).toHaveBeenCalledWith('t');
  });

  it('enroll/confirm: backup codes only, NO session', async () => {
    const dto = { mfaToken: 't', code: '123456' };
    await expect(controller.enrollConfirm(dto)).resolves.toEqual({
      code: 'MFA_BACKUP_CODES_ISSUED',
      backupCodes: ['AAAAA-BBBBB'],
    });
    expect(mfa.enrollConfirm).toHaveBeenCalledWith(dto);
    expect(auth.issueTokensForUser).not.toHaveBeenCalled();
  });

  it('enroll/codes: the same codes again, NO session', async () => {
    await expect(controller.enrollCodes({ mfaToken: 't' })).resolves.toEqual({
      backupCodes: ['AAAAA-BBBBB'],
    });
    expect(mfa.enrollCodes).toHaveBeenCalledWith('t');
    expect(auth.issueTokensForUser).not.toHaveBeenCalled();
  });

  it("enroll/complete: login-success shape, session for the step's device", async () => {
    const dto = { mfaToken: 't', deviceId: 'd', platform: 'mobile' };
    await expect(controller.enrollComplete(dto)).resolves.toEqual({
      code: 'LOGIN_SUCCESS',
      ...tokens,
    });
    expect(mfa.enrollComplete).toHaveBeenCalledWith(dto);
    // A record without a method (pre-deploy) → a password session.
    expect(auth.issueTokensForUser).toHaveBeenCalledWith(
      user,
      'd',
      'mobile',
      'password',
    );
  });

  it('verify: login-success shape plus backupCodesRemaining', async () => {
    await expect(
      controller.verify({ mfaToken: 't', code: '123456' }),
    ).resolves.toEqual({
      code: 'LOGIN_SUCCESS',
      ...tokens,
      backupCodesRemaining: 7,
    });
    expect(auth.issueTokensForUser).toHaveBeenCalledWith(
      user,
      'web-login',
      'web',
      'password',
    );
  });

  it('the sign-in method of the pending step becomes the session method', async () => {
    mfa.verify.mockResolvedValueOnce({
      user,
      deviceId: 'd',
      platform: 'web',
      method: 'google',
      backupCodesRemaining: 7,
    });
    await controller.verify({ mfaToken: 't', code: '123456' });
    expect(auth.issueTokensForUser).toHaveBeenLastCalledWith(
      user,
      'd',
      'web',
      'google',
    );
    mfa.enrollComplete.mockResolvedValueOnce({
      user,
      deviceId: 'd',
      platform: 'web',
      method: 'invite',
    });
    await controller.enrollComplete({ mfaToken: 't' });
    expect(auth.issueTokensForUser).toHaveBeenLastCalledWith(
      user,
      'd',
      'web',
      'invite',
    );
  });

  it('a failed step never issues a session', async () => {
    mfa.verify.mockRejectedValue(new Error('MFA_CODE_INVALID'));
    mfa.enrollComplete.mockRejectedValue(new Error('MFA_TOKEN_INVALID'));
    await expect(
      controller.verify({ mfaToken: 't', code: '000000' }),
    ).rejects.toThrow();
    await expect(
      controller.enrollComplete({ mfaToken: 't' }),
    ).rejects.toThrow();
    expect(auth.issueTokensForUser).not.toHaveBeenCalled();
  });
});

describe('MfaLoginController + MfaService: enrollment sequence', () => {
  const UID = '64b0000000000000000000a1';
  const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

  it('confirm → no session; codes → same codes; complete → one session; complete again → MFA_TOKEN_INVALID', async () => {
    const redis = new FakeRedis();
    const pending = new MfaPendingStore(redis as never);
    const crypto = new MfaCryptoService({
      get: (k: string) => (k === 'SESSION_SECRET' ? 's'.repeat(64) : undefined),
    } as unknown as ConfigService);
    const users = createFakeUserModel({
      _id: UID,
      email: 'owner@acme.com',
      displayName: 'Owner',
      status: 'active',
    });
    const service = new MfaService(
      users as never,
      pending,
      new MfaCodeService(redis as never),
      crypto,
      { record: jest.fn() } as never,
    );
    const auth = {
      issueTokensForUser: jest.fn().mockResolvedValue({ sid: 's1' }),
    };
    const controller = new MfaLoginController(service, auth as never);

    const mfaToken = await pending.create({
      userId: UID,
      stage: 'enroll',
      deviceId: 'web-login',
      platform: 'web',
    });
    const { key } = (await pending.get(mfaToken))!;
    await pending.setSecretIfAbsent(key, crypto.encrypt(SECRET, UID));

    const confirm = await controller.enrollConfirm({
      mfaToken,
      code: authenticator.generate(SECRET),
    });
    expect(confirm.code).toBe('MFA_BACKUP_CODES_ISSUED');
    expect(confirm.backupCodes).toHaveLength(10);
    expect(confirm).not.toHaveProperty('accessToken');
    expect(auth.issueTokensForUser).not.toHaveBeenCalled();

    await expect(controller.enrollCodes({ mfaToken })).resolves.toEqual({
      backupCodes: confirm.backupCodes,
    });
    expect(auth.issueTokensForUser).not.toHaveBeenCalled();

    await expect(
      controller.enrollComplete({ mfaToken, platform: 'web' }),
    ).resolves.toEqual({ code: 'LOGIN_SUCCESS', sid: 's1' });
    expect(auth.issueTokensForUser).toHaveBeenCalledTimes(1);
    expect(auth.issueTokensForUser.mock.calls[0][0]).toMatchObject({
      _id: UID,
    });

    await expect(controller.enrollComplete({ mfaToken })).rejects.toMatchObject(
      {
        status: 401,
        response: { code: 'MFA_TOKEN_INVALID' },
      },
    );
    expect(auth.issueTokensForUser).toHaveBeenCalledTimes(1);
  }, 30_000);
});
