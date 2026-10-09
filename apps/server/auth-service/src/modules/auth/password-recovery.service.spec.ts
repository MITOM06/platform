jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('reset-hash'),
}));

import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PasswordRecoveryService } from './password-recovery.service';
import { ssoRequired } from '../sso/sso-policy.service';

describe('PasswordRecoveryService', () => {
  let users: Record<string, jest.Mock>;
  let session: { revokeAllSessions: jest.Mock };
  let mail: { sendOtpEmail: jest.Mock };
  let redis: Record<string, jest.Mock>;
  let sso: { assertNotEnforced: jest.Mock };
  let service: PasswordRecoveryService;

  const activeUser = {
    _id: { toString: () => 'u1' },
    email: 'jane@acme.com',
    displayName: 'Jane',
    status: 'active',
  };
  const otpUser = () => ({
    ...activeUser,
    otpCode: createHash('sha256').update('123456').digest('hex'),
    otpExpires: new Date(Date.now() + 60_000),
  });

  beforeEach(() => {
    users = {
      findByEmail: jest.fn().mockResolvedValue(activeUser),
      updateOtp: jest.fn().mockResolvedValue(undefined),
      setVerified: jest.fn().mockResolvedValue(undefined),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    session = { revokeAllSessions: jest.fn().mockResolvedValue(undefined) };
    mail = { sendOtpEmail: jest.fn().mockResolvedValue(undefined) };
    redis = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn(),
    };
    sso = { assertNotEnforced: jest.fn().mockResolvedValue(undefined) };
    service = new PasswordRecoveryService(
      mail as never,
      session as never,
      users as never,
      { get: (_k: string, d?: unknown) => d } as unknown as ConfigService,
      sso as never,
      redis as never,
    );
  });

  describe('blocked accounts', () => {
    it('forgot-password / resend-otp → 403 ACCOUNT_BLOCKED and no OTP', async () => {
      users.findByEmail.mockResolvedValue({ ...activeUser, status: 'blocked' });
      await expect(
        service.forgotPassword('jane@acme.com'),
      ).rejects.toMatchObject({
        response: { code: 'ACCOUNT_BLOCKED' },
      });
      await expect(service.resendOtp('jane@acme.com')).rejects.toMatchObject({
        response: { code: 'ACCOUNT_BLOCKED' },
      });
      expect(users.updateOtp).not.toHaveBeenCalled();
    });
  });

  describe('reset-password', () => {
    it('writes through updatePassword (which clears mustSetPassword) and revokes sessions', async () => {
      users.findByEmail.mockResolvedValue(otpUser());
      await expect(
        service.resetPassword('jane@acme.com', '123456', 'N3wPassw0rd'),
      ).resolves.toEqual({ success: true, code: 'PASSWORD_UPDATED' });
      expect(users.updatePassword).toHaveBeenCalledWith('u1', 'reset-hash');
      expect(session.revokeAllSessions).toHaveBeenCalledWith(
        'u1',
        'password_reset',
      );
    });
  });

  it('forgot-password mails a hashed OTP', async () => {
    await expect(
      service.forgotPassword('jane@acme.com', 'vi'),
    ).resolves.toEqual({
      success: true,
      code: 'OTP_SENT',
    });
    expect(users.updateOtp).toHaveBeenCalledWith(
      activeUser._id,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.any(Date),
    );
    expect(mail.sendOtpEmail).toHaveBeenCalledWith(
      'jane@acme.com',
      expect.stringMatching(/^\d{6}$/),
      'vi',
    );
  });

  it('an unverified login mails an OTP and answers ACCOUNT_UNVERIFIED_OTP_SENT', async () => {
    await expect(
      service.rejectUnverifiedLogin(activeUser, 'en'),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        code: 'ACCOUNT_UNVERIFIED_OTP_SENT',
        params: { email: 'jane@acme.com' },
      },
    });
    expect(mail.sendOtpEmail).toHaveBeenCalled();
  });

  describe('Require SSO: 403 SSO_REQUIRED, nothing mailed or written', () => {
    beforeEach(() => sso.assertNotEnforced.mockRejectedValue(ssoRequired()));

    it('forgot-password', async () => {
      await expect(
        service.forgotPassword('jane@acme.com'),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'SSO_REQUIRED' },
      });
      expect(sso.assertNotEnforced).toHaveBeenCalledWith(activeUser);
      expect(users.updateOtp).not.toHaveBeenCalled();
      expect(mail.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('resend-otp', async () => {
      await expect(service.resendOtp('jane@acme.com')).rejects.toMatchObject({
        response: { code: 'SSO_REQUIRED' },
      });
      expect(mail.sendOtpEmail).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('reset-password: refused before the OTP is checked (no attempt used up)', async () => {
      users.findByEmail.mockResolvedValue(otpUser());
      await expect(
        service.resetPassword('jane@acme.com', '000000', 'N3wPassw0rd'),
      ).rejects.toMatchObject({ response: { code: 'SSO_REQUIRED' } });
      expect(redis.incr).not.toHaveBeenCalled();
      expect(users.updatePassword).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
    });
  });
});
