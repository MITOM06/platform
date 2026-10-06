jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('reset-hash'),
}));

import { createHash } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { REDIS_CLIENT } from '@platform/database';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { ClaimsService } from './claims.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../Email/mail.service';
import { OtpService } from './otp.service';
import { SsoMappingService } from './oidc/sso-mapping.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocialProvisioningService } from './social-provisioning.service';
import { OAuthRedirectService } from './oauth-redirect.service';
import { LoginAttemptsService } from './login-attempts.service';
import { MfaChallengeService } from '../mfa/mfa-challenge.service';

describe('AuthService — account status enforcement (invite-only)', () => {
  let service: AuthService;
  let users: Record<string, jest.Mock>;
  let session: Record<string, jest.Mock>;
  let attempts: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;
  let mfa: { challengeIfRequired: jest.Mock };

  const activeUser = {
    _id: { toString: () => 'u1' },
    email: 'jane@acme.com',
    displayName: 'Jane',
    password: 'hash',
    isVerified: true,
    status: 'active',
  };

  beforeEach(async () => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      getHasPassword: jest.fn().mockResolvedValue(true),
    };
    session = {
      createSession: jest
        .fn()
        .mockResolvedValue({ sid: 's1', refreshToken: 'r1' }),
      rotateRefreshToken: jest
        .fn()
        .mockResolvedValue({ userId: 'u1', newRefreshToken: 'r2' }),
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
      peekSessionUserId: jest.fn().mockResolvedValue('u1'),
      refreshTokenBelongsToSession: jest.fn().mockResolvedValue(true),
    };
    attempts = {
      checkBruteForce: jest.fn().mockResolvedValue(undefined),
      handleFailedLogin: jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException({ code: 'LOGIN_FAILED_WITH_REMAINING' }),
        ),
      reset: jest.fn().mockResolvedValue(undefined),
    };
    redis = { getdel: jest.fn() };
    // Default: not privileged → normal sign-in.
    mfa = { challengeIfRequired: jest.fn().mockResolvedValue(null) };
    (bcrypt.compare as jest.Mock).mockReset().mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('jwt') },
        },
        { provide: SessionService, useValue: session },
        {
          provide: ClaimsService,
          useValue: {
            resolve: jest
              .fn()
              .mockResolvedValue({ role: 'Member', perms: [], depts: [] }),
          },
        },
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: {} },
        // Real OtpService over the mocked UsersService/MailService, so OTP
        // paths behave exactly as they do in production.
        OtpService,
        { provide: SsoMappingService, useValue: {} },
        {
          provide: NotificationsService,
          useValue: {
            createSetupNotificationsIfNeeded: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        { provide: SocialProvisioningService, useValue: {} },
        { provide: OAuthRedirectService, useValue: {} },
        { provide: LoginAttemptsService, useValue: attempts },
        { provide: MfaChallengeService, useValue: mfa },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('issues LoginTokens for an active user', async () => {
      users.findByEmail.mockResolvedValue(activeUser);
      const res = await service.login({
        email: 'jane@acme.com',
        password: 'x',
      } as any);
      expect(res).toEqual({
        code: 'LOGIN_SUCCESS',
        accessToken: 'jwt',
        refreshToken: 'r1',
        sid: 's1',
        user: {
          id: 'u1',
          email: 'jane@acme.com',
          displayName: 'Jane',
          mustSetPassword: false,
        },
      });
    });

    it('LoginTokens.user carries the account mustSetPassword flag', async () => {
      users.findByEmail.mockResolvedValue({
        ...activeUser,
        mustSetPassword: true,
      });
      const res = await service.login({
        email: 'jane@acme.com',
        password: 'x',
      } as any);
      expect((res as any)?.user.mustSetPassword).toBe(true);
    });

    it('blocked → 403 ACCOUNT_BLOCKED, counter reset, no session', async () => {
      users.findByEmail.mockResolvedValue({ ...activeUser, status: 'blocked' });
      await expect(
        service.login({ email: 'jane@acme.com', password: 'x' } as any),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'ACCOUNT_BLOCKED' },
      });
      expect(attempts.reset).toHaveBeenCalledWith('jane@acme.com');
      expect(session.createSession).not.toHaveBeenCalled();
    });

    it('legacy pending → 403 INVITATION_PENDING', async () => {
      users.findByEmail.mockResolvedValue({ ...activeUser, status: 'pending' });
      await expect(
        service.login({ email: 'jane@acme.com', password: 'x' } as any),
      ).rejects.toMatchObject({ response: { code: 'INVITATION_PENDING' } });
    });

    it('Google-only user (no password) → failed attempt, never bcrypt/500', async () => {
      users.findByEmail.mockResolvedValue({
        ...activeUser,
        password: undefined,
      });
      await expect(
        service.login({ email: 'jane@acme.com', password: 'x' } as any),
      ).rejects.toMatchObject({
        response: { code: 'LOGIN_FAILED_WITH_REMAINING' },
      });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(attempts.handleFailedLogin).toHaveBeenCalled();
    });
  });

  describe('exchangeLoginCode', () => {
    it('blocked user → 403 ACCOUNT_BLOCKED without a session', async () => {
      redis.getdel.mockResolvedValue('u1');
      users.findById.mockResolvedValue({ ...activeUser, status: 'blocked' });
      await expect(service.exchangeLoginCode('c')).rejects.toMatchObject({
        response: { code: 'ACCOUNT_BLOCKED' },
      });
      expect(session.createSession).not.toHaveBeenCalled();
    });

    it('user gone → 401 LOGIN_CODE_INVALID', async () => {
      redis.getdel.mockResolvedValue('u1');
      users.findById.mockResolvedValue(null);
      await expect(service.exchangeLoginCode('c')).rejects.toMatchObject({
        status: 401,
        response: { code: 'LOGIN_CODE_INVALID' },
      });
    });

    it('single-use: unknown / consumed code → 401 LOGIN_CODE_INVALID', async () => {
      redis.getdel.mockResolvedValue(null);
      await expect(service.exchangeLoginCode('c')).rejects.toMatchObject({
        response: { code: 'LOGIN_CODE_INVALID' },
      });
      expect(redis.getdel).toHaveBeenCalledWith('login_code:c');
    });

    it('active user → tokens', async () => {
      redis.getdel.mockResolvedValue('u1');
      users.findById.mockResolvedValue(activeUser);
      await expect(
        service.exchangeLoginCode('c', 'd', 'mobile'),
      ).resolves.toMatchObject({
        accessToken: 'jwt',
        refreshToken: 'r1',
        sid: 's1',
        user: { email: 'jane@acme.com', mustSetPassword: false },
      });
    });

    it('Google invitee → user.mustSetPassword:true so the client gates before /me', async () => {
      redis.getdel.mockResolvedValue('u1');
      users.findById.mockResolvedValue({
        ...activeUser,
        password: undefined,
        mustSetPassword: true,
      });
      const res = await service.exchangeLoginCode('c', 'd', 'web');
      expect((res as any).user.mustSetPassword).toBe(true);
    });
  });

  describe('mandatory 2FA gate (privileged users)', () => {
    const challenge = {
      code: 'MFA_REQUIRED',
      mfaToken: 'mfa-token',
      enrollmentRequired: true,
      user: { id: 'u1', email: 'jane@acme.com', displayName: 'Jane' },
    };

    it('login: MFA_REQUIRED is returned and NO session / token is created', async () => {
      users.findByEmail.mockResolvedValue(activeUser);
      mfa.challengeIfRequired.mockResolvedValue(challenge);
      const res = await service.login({ email: 'jane@acme.com', password: 'x' } as any);
      expect(res).toEqual(challenge);
      expect(mfa.challengeIfRequired).toHaveBeenCalledWith(activeUser, {
        deviceId: 'web-login',
        platform: 'web',
      });
      expect(session.createSession).not.toHaveBeenCalled();
      // The password was right: the brute-force counter is cleared.
      expect(attempts.reset).toHaveBeenCalledWith('jane@acme.com');
    });

    it('login: wrong password never reaches the 2FA gate', async () => {
      users.findByEmail.mockResolvedValue(activeUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: 'jane@acme.com', password: 'bad' } as any),
      ).rejects.toMatchObject({ response: { code: 'LOGIN_FAILED_WITH_REMAINING' } });
      expect(mfa.challengeIfRequired).not.toHaveBeenCalled();
    });

    it('exchange of a Google login code: MFA_REQUIRED, no session; device/platform carried', async () => {
      redis.getdel.mockResolvedValue(JSON.stringify({ userId: 'u1', via: 'google' }));
      users.findById.mockResolvedValue(activeUser);
      mfa.challengeIfRequired.mockResolvedValue(challenge);
      await expect(service.exchangeLoginCode('c', 'dev-1', 'mobile')).resolves.toEqual(challenge);
      expect(mfa.challengeIfRequired).toHaveBeenCalledWith(activeUser, {
        deviceId: 'dev-1',
        platform: 'mobile',
      });
      expect(session.createSession).not.toHaveBeenCalled();
    });

    it('exchange of a legacy (pre-2FA) bare-userId code still goes through the gate', async () => {
      redis.getdel.mockResolvedValue('u1');
      users.findById.mockResolvedValue(activeUser);
      mfa.challengeIfRequired.mockResolvedValue(challenge);
      await expect(service.exchangeLoginCode('c')).resolves.toEqual(challenge);
    });

    it('exchange of an OIDC SSO code skips 2FA and issues tokens', async () => {
      redis.getdel.mockResolvedValue(JSON.stringify({ userId: 'u1', via: 'oidc' }));
      users.findById.mockResolvedValue(activeUser);
      mfa.challengeIfRequired.mockResolvedValue(challenge);
      await expect(service.exchangeLoginCode('c', 'd', 'web')).resolves.toMatchObject({
        userId: 'u1',
        sid: 's1',
        accessToken: 'jwt',
      });
      expect(mfa.challengeIfRequired).not.toHaveBeenCalled();
      expect(session.createSession).toHaveBeenCalled();
    });

    it('OIDC SSO callback mints an "oidc" login code (exempt at exchange)', async () => {
      const redirectWithLoginCode = jest.fn().mockResolvedValue(undefined);
      Object.assign(service['ssoMapping'], {
        getGate: jest.fn().mockResolvedValue({ enabled: true, allowedDomains: [] }),
        apply: jest.fn().mockResolvedValue({ changed: false }),
      });
      Object.assign(service['socialProvisioning'], {
        resolveUserId: jest.fn().mockResolvedValue('u1'),
      });
      Object.assign(service['oauthRedirect'], { redirectWithLoginCode });
      const res = {} as any;
      await service.handleOidcLogin(
        { email: 'jane@acme.com', displayName: 'Jane', id: 'sub', groups: [] },
        res,
        'web',
      );
      expect(redirectWithLoginCode).toHaveBeenCalledWith('u1', res, 'web', 'oidc');
    });

    it('blocked user is refused before the gate (no 2FA token minted)', async () => {
      redis.getdel.mockResolvedValue(JSON.stringify({ userId: 'u1', via: 'google' }));
      users.findById.mockResolvedValue({ ...activeUser, status: 'blocked' });
      await expect(service.exchangeLoginCode('c')).rejects.toMatchObject({
        response: { code: 'ACCOUNT_BLOCKED' },
      });
      expect(mfa.challengeIfRequired).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('blocked user → status checked BEFORE rotation: revokes all + 403 ACCOUNT_BLOCKED', async () => {
      users.findById.mockResolvedValue({ ...activeUser, status: 'blocked' });
      // Sessions of a blocked user are already revoked: rotating first would
      // surface SESSION_REVOKED instead of ACCOUNT_BLOCKED.
      session.rotateRefreshToken.mockRejectedValue(
        new UnauthorizedException({ code: 'SESSION_REVOKED' }),
      );
      await expect(service.refresh('s1', 'r1')).rejects.toMatchObject({
        status: 403,
        response: { code: 'ACCOUNT_BLOCKED' },
      });
      expect(session.refreshTokenBelongsToSession).toHaveBeenCalledWith('s1', 'r1');
      expect(session.revokeAllSessions).toHaveBeenCalledWith('u1', 'blocked');
      expect(session.rotateRefreshToken).not.toHaveBeenCalled();
    });

    it('blocked user but foreign refresh token → normal session error, status not revealed', async () => {
      users.findById.mockResolvedValue({ ...activeUser, status: 'blocked' });
      session.refreshTokenBelongsToSession.mockResolvedValue(false);
      session.rotateRefreshToken.mockRejectedValue(
        new UnauthorizedException({ code: 'REFRESH_TOKEN_INVALID' }),
      );
      await expect(service.refresh('s1', 'bogus')).rejects.toMatchObject({
        response: { code: 'REFRESH_TOKEN_INVALID' },
      });
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
    });

    it('unknown session → falls through to the rotation error', async () => {
      session.peekSessionUserId.mockResolvedValue(null);
      session.rotateRefreshToken.mockRejectedValue(
        new UnauthorizedException({ code: 'SESSION_INVALID' }),
      );
      await expect(service.refresh('nope', 'r1')).rejects.toMatchObject({
        response: { code: 'SESSION_INVALID' },
      });
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('active user → new tokens', async () => {
      users.findById.mockResolvedValue(activeUser);
      await expect(service.refresh('s1', 'r1')).resolves.toEqual({
        accessToken: 'jwt',
        refreshToken: 'r2',
      });
      expect(session.refreshTokenBelongsToSession).not.toHaveBeenCalled();
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
    });
  });

  describe('forgot-password / resend-otp', () => {
    it('blocked user gets 403 ACCOUNT_BLOCKED and no OTP', async () => {
      redis.incr = jest.fn().mockResolvedValue(1);
      redis.expire = jest.fn();
      redis.get = jest.fn().mockResolvedValue(null);
      users.findByEmail.mockResolvedValue({ ...activeUser, status: 'blocked' });
      users.updateOtp = jest.fn();

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
      redis.incr = jest.fn().mockResolvedValue(1);
      redis.expire = jest.fn();
      redis.del = jest.fn();
      users.findByEmail.mockResolvedValue({
        ...activeUser,
        otpCode: createHash('sha256').update('123456').digest('hex'),
        otpExpires: new Date(Date.now() + 60_000),
      });
      users.setVerified = jest.fn();
      users.updatePassword = jest.fn().mockResolvedValue(undefined);

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
});

/**
 * Stateful fakes for the OTP flows: `users` mirrors the real UsersService
 * semantics (setVerified marks verified WITHOUT consuming the code; a successful
 * updatePassword consumes it), `redis` is an in-memory key/value + counter store.
 */
describe('AuthService — OTP / email-normalization flows', () => {
  let service: AuthService;
  let store: Map<string, string>;
  let user: any;
  let users: Record<string, jest.Mock>;
  let session: Record<string, jest.Mock>;
  let attempts: Record<string, jest.Mock>;
  let mail: { sendOtpEmail: jest.Mock };
  const sha = (v: string) => createHash('sha256').update(v).digest('hex');

  beforeEach(async () => {
    store = new Map();
    user = {
      _id: { toString: () => 'u1' },
      email: 'bob@qc.test',
      displayName: 'Bob',
      password: 'old-hash',
      isVerified: true,
      status: 'active',
      otpCode: undefined,
      otpExpires: undefined,
    };
    users = {
      findByEmail: jest.fn(async () => user),
      updateOtp: jest.fn(async (_id: unknown, hash: string, expires: Date) => {
        user.otpCode = hash;
        user.otpExpires = expires;
      }),
      setVerified: jest.fn(async () => {
        user.isVerified = true; // the code is NOT consumed
      }),
      updatePassword: jest.fn(async (_id: string, hash: string) => {
        user.password = hash;
        user.otpCode = undefined;
        user.otpExpires = undefined;
      }),
      getHasPassword: jest.fn().mockResolvedValue(true),
    };
    session = {
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
      createSession: jest.fn().mockResolvedValue({ sid: 's1', refreshToken: 'r1' }),
    };
    attempts = {
      checkBruteForce: jest.fn().mockResolvedValue(undefined),
      handleFailedLogin: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException({ code: 'LOGIN_FAILED_WITH_REMAINING' })),
      reset: jest.fn().mockResolvedValue(undefined),
    };
    mail = { sendOtpEmail: jest.fn().mockResolvedValue(undefined) };
    const redis = {
      incr: jest.fn(async (k: string) => {
        const n = Number(store.get(k) ?? 0) + 1;
        store.set(k, String(n));
        return n;
      }),
      expire: jest.fn(async () => 1),
      del: jest.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
        return 'OK';
      }),
      ttl: jest.fn(async () => 42),
    };
    (bcrypt.compare as jest.Mock).mockReset().mockResolvedValue(true);
    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('jwt') } },
        { provide: SessionService, useValue: session },
        {
          provide: ClaimsService,
          useValue: { resolve: jest.fn().mockResolvedValue({ role: 'Member', perms: [], depts: [] }) },
        },
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: mail },
        OtpService,
        { provide: SsoMappingService, useValue: {} },
        {
          provide: NotificationsService,
          useValue: { createSetupNotificationsIfNeeded: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: SocialProvisioningService, useValue: {} },
        { provide: OAuthRedirectService, useValue: {} },
        { provide: LoginAttemptsService, useValue: attempts },
        { provide: ConfigService, useValue: { get: (_k: string, d?: unknown) => d } },
        { provide: MfaChallengeService, useValue: { challengeIfRequired: jest.fn().mockResolvedValue(null) } },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  function emailedOtp(): string {
    const calls = mail.sendOtpEmail.mock.calls;
    return calls[calls.length - 1][1];
  }

  it('mobile forgot-password: verify-otp THEN reset-password with the same code succeeds (E2E)', async () => {
    await service.forgotPassword('bob@qc.test');
    const otp = emailedOtp();
    expect(user.otpCode).toBe(sha(otp));

    await expect(service.verifyOtp('bob@qc.test', otp)).resolves.toMatchObject({
      code: 'OTP_VALID',
    });
    // verify-otp must not consume the code…
    expect(user.otpCode).toBe(sha(otp));

    await expect(service.resetPassword('bob@qc.test', otp, 'new-password')).resolves.toMatchObject(
      { code: 'PASSWORD_UPDATED' },
    );
    expect(users.updatePassword).toHaveBeenCalledWith('u1', 'new-hash');
    expect(session.revokeAllSessions).toHaveBeenCalledWith('u1', 'password_reset');
  });

  it('a replayed reset after a successful reset still fails (the reset consumed the code)', async () => {
    await service.forgotPassword('bob@qc.test');
    const otp = emailedOtp();
    await service.resetPassword('bob@qc.test', otp, 'new-password');

    await expect(service.resetPassword('bob@qc.test', otp, 'evil-password')).rejects.toMatchObject(
      { status: 400, response: { code: 'OTP_INVALID' } },
    );
    expect(users.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('normalizes the email (trim + lower-case) for the lookup and every Redis key', async () => {
    await service.forgotPassword('  Bob@QC.test ');
    expect(users.findByEmail).toHaveBeenLastCalledWith('bob@qc.test');
    expect(store.get('forgot_otp_rate:bob@qc.test')).toBe('1');
    // The code is mailed to the address on file, not the typed variant.
    expect(mail.sendOtpEmail.mock.calls[0][0]).toBe('bob@qc.test');

    const otp = emailedOtp();
    await service.verifyOtp('BOB@qc.TEST', '000000' === otp ? '111111' : '000000').catch(() => {});
    expect(store.get('otp_attempts:bob@qc.test')).toBe('1');
    await service.verifyOtp('Bob@Qc.Test', otp);

    await service.resendOtp('BOB@QC.TEST').catch(() => {});
    expect(store.has('otp_resend_cooldown:bob@qc.test')).toBe(true);
  });

  it('login: case variants hit the same account and the same brute-force counters', async () => {
    const res = await service.login({ email: ' Bob@QC.test', password: 'pw' } as any);
    expect(res).toMatchObject({ code: 'LOGIN_SUCCESS' });
    expect(attempts.checkBruteForce).toHaveBeenCalledWith('bob@qc.test');
    expect(users.findByEmail).toHaveBeenCalledWith('bob@qc.test');
    expect(attempts.reset).toHaveBeenCalledWith('bob@qc.test');

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(
      service.login({ email: 'BOB@qc.test', password: 'bad' } as any),
    ).rejects.toMatchObject({ response: { code: 'LOGIN_FAILED_WITH_REMAINING' } });
    expect(attempts.handleFailedLogin).toHaveBeenCalledWith('bob@qc.test');
  });

  it('resend-otp keeps the wrong-guess counter (no fresh batch of guesses per resend)', async () => {
    await service.forgotPassword('bob@qc.test');
    const otp = emailedOtp();
    const wrong = otp === '123456' ? '654321' : '123456';
    for (let i = 0; i < 3; i++) {
      await service.verifyOtp('bob@qc.test', wrong).catch(() => {});
    }
    expect(store.get('otp_attempts:bob@qc.test')).toBe('3');

    await service.resendOtp('bob@qc.test');
    expect(store.get('otp_attempts:bob@qc.test')).toBe('3');

    await service.verifyOtp('bob@qc.test', wrong).catch(() => {});
    await service.verifyOtp('bob@qc.test', wrong).catch(() => {});
    // 6th guess overall → exceeded even though a new code was sent.
    await expect(service.verifyOtp('bob@qc.test', emailedOtp())).rejects.toMatchObject({
      response: { code: 'OTP_ATTEMPTS_EXCEEDED' },
    });
  });
});
