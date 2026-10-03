jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));
jest.mock('bcrypt', () => ({ compare: jest.fn() }));

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

describe('AuthService — account status enforcement (invite-only)', () => {
  let service: AuthService;
  let users: Record<string, jest.Mock>;
  let session: Record<string, jest.Mock>;
  let attempts: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;

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
        user: { id: 'u1', email: 'jane@acme.com', displayName: 'Jane' },
      });
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
      });
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
});
