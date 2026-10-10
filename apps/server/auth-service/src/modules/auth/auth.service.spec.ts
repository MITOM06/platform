jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  genSalt: jest.fn().mockResolvedValue('salt'),
  hash: jest.fn().mockResolvedValue('reset-hash'),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { REDIS_CLIENT } from '@platform/database';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { ClaimsService } from './claims.service';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { MailService } from '../Email/mail.service';
import { SsoMappingService } from './oidc/sso-mapping.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocialProvisioningService } from './social-provisioning.service';
import { OAuthRedirectService } from './oauth-redirect.service';
import { LoginAttemptsService } from './login-attempts.service';
import { MfaChallengeService } from '../mfa/mfa-challenge.service';
import { MfaPendingStore } from '../mfa/mfa-pending.store';
import { FakeRedis } from '../mfa/fake-redis.spec-helper';
import { SsoPolicyService, ssoRequired } from '../sso/sso-policy.service';
import { PasswordRecoveryService } from './password-recovery.service';

describe('AuthService — sign-in, sessions, Require SSO', () => {
  let service: AuthService;
  let users: Record<string, jest.Mock>;
  let session: Record<string, jest.Mock>;
  let attempts: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;
  let mfa: { challengeIfRequired: jest.Mock };
  let sso: { isEnforcedFor: jest.Mock; assertNotEnforced: jest.Mock };
  let recovery: { rejectUnverifiedLogin: jest.Mock };
  let ssoMapping: Record<string, jest.Mock>;

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
      markClaimsStale: jest.fn().mockResolvedValue(undefined),
      peekSession: jest
        .fn()
        .mockResolvedValue({ userId: 'u1', method: 'password' }),
      refreshTokenBelongsToSession: jest.fn().mockResolvedValue(true),
      revokeSessionsNotCreatedBy: jest.fn().mockResolvedValue(1),
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
    // Default: no 2FA step (as for a bot) → tokens; 2FA tests override it.
    mfa = { challengeIfRequired: jest.fn().mockResolvedValue(null) };
    // Default: Require SSO does not apply.
    sso = {
      isEnforcedFor: jest.fn().mockResolvedValue(false),
      assertNotEnforced: jest.fn(),
    };
    sso.assertNotEnforced.mockImplementation(async (subject: unknown) => {
      if (await sso.isEnforcedFor(subject)) throw ssoRequired();
    });
    recovery = {
      rejectUnverifiedLogin: jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException({ code: 'ACCOUNT_UNVERIFIED_OTP_SENT' }),
        ),
    };
    ssoMapping = {
      getGate: jest.fn().mockResolvedValue({ enabled: true, allowedDomains: [] }),
      apply: jest.fn().mockResolvedValue({ changed: false }),
    };
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
        { provide: SsoMappingService, useValue: ssoMapping },
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
        { provide: SsoPolicyService, useValue: sso },
        { provide: PasswordRecoveryService, useValue: recovery },
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

  describe('2FA gate (when the challenge service asks for it)', () => {
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
        method: 'password',
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
        method: 'google',
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
      session.peekSession.mockResolvedValue(null);
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

  describe('2FA policy (real challenge service): mandatory for admins, opt-in for Members', () => {
    let pendingRedis: FakeRedis;
    let pending: MfaPendingStore;
    let claims: { resolve: jest.Mock };
    const asRole = (role: string, perms: string[] = []) =>
      claims.resolve.mockResolvedValue({ role, perms, depts: [] });

    beforeEach(() => {
      pendingRedis = new FakeRedis();
      pending = new MfaPendingStore(pendingRedis as never);
      claims = { resolve: jest.fn() };
      asRole('Member', ['USE_GROUP_BOT']);
      const real = new MfaChallengeService(claims as never, pending);
      mfa.challengeIfRequired.mockImplementation((u, c) =>
        real.challengeIfRequired(u, c),
      );
    });

    it('login of a Member who never turned 2FA on → LOGIN_SUCCESS + tokens, no 2FA step', async () => {
      users.findByEmail.mockResolvedValue(activeUser);
      const res = await service.login({ email: 'jane@acme.com', password: 'x' } as any);
      expect(res).toMatchObject({
        code: 'LOGIN_SUCCESS',
        accessToken: 'jwt',
        refreshToken: 'r1',
        sid: 's1',
      });
      expect(session.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', method: 'password' }),
      );
      expect(pendingRedis.keys('mfa:pending:')).toEqual([]);
    });

    it('login of a Member who turned 2FA on → MFA_REQUIRED (verify), no session', async () => {
      users.findByEmail.mockResolvedValue({ ...activeUser, mfa: { enabled: true } });
      const res = await service.login({ email: 'jane@acme.com', password: 'x' } as any);
      expect(res).toMatchObject({ code: 'MFA_REQUIRED', enrollmentRequired: false });
      expect(session.createSession).not.toHaveBeenCalled();
      expect(await pending.get((res as any).mfaToken)).toMatchObject({
        userId: 'u1',
        stage: 'verify',
        method: 'password',
      });
    });

    it.each([
      ['Owner', []],
      ['Admin', ['MANAGE_MEMBERS']],
      ['a custom role with MANAGE_WORKSPACE', ['MANAGE_WORKSPACE']],
    ])('login of %s, never enrolled → MFA_REQUIRED (enrollment), no session', async (role, perms) => {
      asRole(role, perms);
      users.findByEmail.mockResolvedValue(activeUser);
      const res = await service.login({ email: 'jane@acme.com', password: 'x' } as any);
      expect(res).toMatchObject({ code: 'MFA_REQUIRED', enrollmentRequired: true });
      expect(session.createSession).not.toHaveBeenCalled();
      expect((await pending.get((res as any).mfaToken))?.stage).toBe('enroll');
    });

    it('login of an enrolled Admin → MFA_REQUIRED (verify)', async () => {
      asRole('Admin', ['MANAGE_MEMBERS']);
      users.findByEmail.mockResolvedValue({ ...activeUser, mfa: { enabled: true } });
      const res = await service.login({ email: 'jane@acme.com', password: 'x' } as any);
      expect(res).toMatchObject({ code: 'MFA_REQUIRED', enrollmentRequired: false });
    });

    it('Google exchange of a Member without 2FA → tokens (google session)', async () => {
      redis.getdel.mockResolvedValue(JSON.stringify({ userId: 'u1', via: 'google' }));
      users.findById.mockResolvedValue(activeUser);
      const res = await service.exchangeLoginCode('c', 'd', 'mobile');
      expect(res).toMatchObject({ userId: 'u1', sid: 's1', accessToken: 'jwt' });
      expect(session.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'google', platform: 'mobile' }),
      );
    });

    it('Google exchange of a Member who turned 2FA on → MFA_REQUIRED (verify), no session', async () => {
      redis.getdel.mockResolvedValue(JSON.stringify({ userId: 'u1', via: 'google' }));
      users.findById.mockResolvedValue({ ...activeUser, mfa: { enabled: true } });
      const res = await service.exchangeLoginCode('c', 'd', 'mobile');
      expect(res).toMatchObject({ code: 'MFA_REQUIRED', enrollmentRequired: false });
      expect(session.createSession).not.toHaveBeenCalled();
      expect((await pending.get((res as any).mfaToken))?.method).toBe('google');
    });

    it('Google exchange of an Admin → MFA_REQUIRED (enrollment), no session', async () => {
      asRole('Admin', ['MANAGE_MEMBERS']);
      redis.getdel.mockResolvedValue(JSON.stringify({ userId: 'u1', via: 'google' }));
      users.findById.mockResolvedValue(activeUser);
      const res = await service.exchangeLoginCode('c', 'd', 'mobile');
      expect(res).toMatchObject({ code: 'MFA_REQUIRED', enrollmentRequired: true });
      expect(session.createSession).not.toHaveBeenCalled();
    });

    it('invitation accepted with a password for a Member role → LOGIN_SUCCESS + invite session', async () => {
      const res = await service.startSignIn(activeUser as any, {
        deviceId: 'web-login',
        platform: 'web',
        method: 'invite',
      });
      expect(res).toMatchObject({ code: 'LOGIN_SUCCESS', sid: 's1', accessToken: 'jwt' });
      expect(session.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'invite' }),
      );
    });

    it('invitation accepted with a password for an Admin role → MFA_REQUIRED (enrollment), no session', async () => {
      asRole('Admin', ['MANAGE_MEMBERS']);
      const res = await service.startSignIn(activeUser as any, {
        deviceId: 'web-login',
        platform: 'web',
        method: 'invite',
      });
      expect(res).toMatchObject({ code: 'MFA_REQUIRED', enrollmentRequired: true });
      expect(session.createSession).not.toHaveBeenCalled();
      expect((await pending.get((res as any).mfaToken))?.method).toBe('invite');
    });

    it('a bot account gets tokens directly (even with an admin role)', async () => {
      asRole('Admin', ['MANAGE_MEMBERS']);
      const res = await service.startSignIn({ ...activeUser, isBot: true } as any, {
        deviceId: 'svc',
        platform: 'web',
        method: 'password',
      });
      expect(res).toMatchObject({ code: 'LOGIN_SUCCESS', sid: 's1' });
    });

    it('an OIDC exchange skips 2FA entirely (even an enrolled Admin)', async () => {
      asRole('Admin', ['MANAGE_MEMBERS']);
      redis.getdel.mockResolvedValue(JSON.stringify({ userId: 'u1', via: 'oidc' }));
      users.findById.mockResolvedValue({ ...activeUser, mfa: { enabled: true } });
      await expect(service.exchangeLoginCode('c')).resolves.toMatchObject({ sid: 's1' });
      expect(pendingRedis.keys('mfa:pending:')).toEqual([]);
    });
  });

  describe('Require SSO (enforced member)', () => {
    const enforcedFor = (...emails: string[]) =>
      sso.isEnforcedFor.mockImplementation(async (s: { email?: string } | null) =>
        emails.includes(String(s?.email)),
      );

    describe('password login', () => {
      it.each([
        ['right', true],
        ['wrong', false],
      ])(
        '%s password → 403 SSO_REQUIRED; password never compared, nothing counted',
        async (_l, matches) => {
          enforcedFor('jane@acme.com');
          users.findByEmail.mockResolvedValue(activeUser);
          (bcrypt.compare as jest.Mock).mockResolvedValue(matches);
          await expect(
            service.login({ email: 'jane@acme.com', password: 'x' } as any),
          ).rejects.toMatchObject({ status: 403, response: { code: 'SSO_REQUIRED' } });
          expect(bcrypt.compare).not.toHaveBeenCalled();
          expect(attempts.handleFailedLogin).not.toHaveBeenCalled();
          expect(attempts.reset).not.toHaveBeenCalled();
          expect(mfa.challengeIfRequired).not.toHaveBeenCalled();
          expect(session.createSession).not.toHaveBeenCalled();
        },
      );

      it('unknown email in an enforced domain → the same SSO_REQUIRED (no enumeration)', async () => {
        enforcedFor('ghost@acme.com');
        users.findByEmail.mockResolvedValue(null);
        await expect(
          service.login({ email: 'ghost@acme.com', password: 'x' } as any),
        ).rejects.toMatchObject({ response: { code: 'SSO_REQUIRED' } });
        expect(sso.isEnforcedFor).toHaveBeenCalledWith({ email: 'ghost@acme.com' });
        expect(attempts.handleFailedLogin).not.toHaveBeenCalled();
      });

      it('a blocked enforced member gets SSO_REQUIRED (status not revealed without a password check)', async () => {
        enforcedFor('jane@acme.com');
        users.findByEmail.mockResolvedValue({ ...activeUser, status: 'blocked' });
        await expect(
          service.login({ email: 'jane@acme.com', password: 'x' } as any),
        ).rejects.toMatchObject({ response: { code: 'SSO_REQUIRED' } });
      });

      it('not enforced (e.g. an Owner) → normal password flow', async () => {
        users.findByEmail.mockResolvedValue(activeUser);
        await expect(
          service.login({ email: 'jane@acme.com', password: 'x' } as any),
        ).resolves.toMatchObject({ code: 'LOGIN_SUCCESS' });
        expect(bcrypt.compare).toHaveBeenCalled();
        expect(session.createSession).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'password' }),
        );
      });

      it('unverified account → OTP path (never a session)', async () => {
        users.findByEmail.mockResolvedValue({ ...activeUser, isVerified: false });
        await expect(
          service.login({ email: 'jane@acme.com', password: 'x' } as any, 'vi'),
        ).rejects.toMatchObject({ response: { code: 'ACCOUNT_UNVERIFIED_OTP_SENT' } });
        expect(recovery.rejectUnverifiedLogin).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'jane@acme.com' }),
          'vi',
        );
        expect(session.createSession).not.toHaveBeenCalled();
      });
    });

    describe('login-code exchange', () => {
      it('Google code → 403 SSO_REQUIRED before 2FA, no session', async () => {
        enforcedFor('jane@acme.com');
        redis.getdel.mockResolvedValue(JSON.stringify({ userId: 'u1', via: 'google' }));
        users.findById.mockResolvedValue(activeUser);
        await expect(service.exchangeLoginCode('c')).rejects.toMatchObject({
          status: 403,
          response: { code: 'SSO_REQUIRED' },
        });
        expect(mfa.challengeIfRequired).not.toHaveBeenCalled();
        expect(session.createSession).not.toHaveBeenCalled();
      });

      it('OIDC code → oidc session; the set-password gate does not apply', async () => {
        enforcedFor('jane@acme.com');
        redis.getdel.mockResolvedValue(JSON.stringify({ userId: 'u1', via: 'oidc' }));
        users.findById.mockResolvedValue({ ...activeUser, mustSetPassword: true });
        const res = await service.exchangeLoginCode('c', 'd', 'web');
        expect(res).toMatchObject({ sid: 's1', user: { mustSetPassword: false } });
        expect(session.createSession).toHaveBeenCalledWith({
          userId: 'u1',
          deviceId: 'd',
          platform: 'web',
          method: 'oidc',
        });
      });
    });

    it('issueTokensForUser refuses a non-SSO session (enforcement switched on during 2FA)', async () => {
      enforcedFor('jane@acme.com');
      for (const method of ['password', 'google', 'invite'] as const) {
        await expect(
          service.issueTokensForUser(activeUser, 'd', 'web', method),
        ).rejects.toMatchObject({ response: { code: 'SSO_REQUIRED' } });
      }
      expect(session.createSession).not.toHaveBeenCalled();
    });

    describe('refresh', () => {
      it.each(['password', 'google', 'invite', ''])(
        'session method "%s" → revoke non-SSO sessions + 403 SSO_REQUIRED, no rotation',
        async (method) => {
          enforcedFor('jane@acme.com');
          users.findById.mockResolvedValue(activeUser);
          session.peekSession.mockResolvedValue({ userId: 'u1', method });
          await expect(service.refresh('s1', 'r1')).rejects.toMatchObject({
            status: 403,
            response: { code: 'SSO_REQUIRED' },
          });
          expect(session.revokeSessionsNotCreatedBy).toHaveBeenCalledWith(
            'u1',
            'oidc',
            'sso_enforced',
          );
          expect(session.rotateRefreshToken).not.toHaveBeenCalled();
        },
      );

      it('an SSO (oidc) session keeps refreshing', async () => {
        enforcedFor('jane@acme.com');
        users.findById.mockResolvedValue(activeUser);
        session.peekSession.mockResolvedValue({ userId: 'u1', method: 'oidc' });
        await expect(service.refresh('s1', 'r1')).resolves.toEqual({
          accessToken: 'jwt',
          refreshToken: 'r2',
        });
        expect(session.revokeSessionsNotCreatedBy).not.toHaveBeenCalled();
      });

      it('a foreign refresh token → normal session error, nothing revoked or revealed', async () => {
        enforcedFor('jane@acme.com');
        users.findById.mockResolvedValue(activeUser);
        session.refreshTokenBelongsToSession.mockResolvedValue(false);
        session.rotateRefreshToken.mockRejectedValue(
          new UnauthorizedException({ code: 'REFRESH_TOKEN_INVALID' }),
        );
        await expect(service.refresh('s1', 'bogus')).rejects.toMatchObject({
          response: { code: 'REFRESH_TOKEN_INVALID' },
        });
        expect(session.revokeSessionsNotCreatedBy).not.toHaveBeenCalled();
      });
    });
  });

  describe('OIDC sign-in: other sessions are touched only when the mapping changed something', () => {
    const profile = { email: 'jane@acme.com', displayName: 'Jane', id: 'sub', groups: ['g'] };
    beforeEach(() => {
      Object.assign(service['socialProvisioning'], {
        resolveUserId: jest.fn().mockResolvedValue('u1'),
      });
      Object.assign(service['oauthRedirect'], {
        redirectWithLoginCode: jest.fn().mockResolvedValue(undefined),
      });
    });

    it('unchanged role / departments → other sessions stay', async () => {
      ssoMapping.apply.mockResolvedValue({ changed: false });
      await service.handleOidcLogin(profile, {} as any, 'web');
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
      expect(session.markClaimsStale).not.toHaveBeenCalled();
    });

    it('changed → claims marked stale (other devices refresh, nobody is signed out)', async () => {
      ssoMapping.apply.mockResolvedValue({ changed: true });
      await service.handleOidcLogin(profile, {} as any, 'web');
      expect(session.markClaimsStale).toHaveBeenCalledWith('u1');
      expect(session.revokeAllSessions).not.toHaveBeenCalled();
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
  // forgot / verify / reset / resend moved to PasswordRecoveryService (real, over the mocks).
  let recovery: PasswordRecoveryService;
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
        // Require SSO off: nothing here is enforced.
        {
          provide: SsoPolicyService,
          useValue: {
            assertNotEnforced: jest.fn().mockResolvedValue(undefined),
            isEnforcedFor: jest.fn().mockResolvedValue(false),
          },
        },
        PasswordRecoveryService,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    recovery = moduleRef.get(PasswordRecoveryService);
  });

  function emailedOtp(): string {
    const calls = mail.sendOtpEmail.mock.calls;
    return calls[calls.length - 1][1];
  }

  it('mobile forgot-password: verify-otp THEN reset-password with the same code succeeds (E2E)', async () => {
    await recovery.forgotPassword('bob@qc.test');
    const otp = emailedOtp();
    expect(user.otpCode).toBe(sha(otp));

    await expect(recovery.verifyOtp('bob@qc.test', otp)).resolves.toMatchObject({
      code: 'OTP_VALID',
    });
    // verify-otp must not consume the code…
    expect(user.otpCode).toBe(sha(otp));

    await expect(recovery.resetPassword('bob@qc.test', otp, 'new-password')).resolves.toMatchObject(
      { code: 'PASSWORD_UPDATED' },
    );
    expect(users.updatePassword).toHaveBeenCalledWith('u1', 'new-hash');
    expect(session.revokeAllSessions).toHaveBeenCalledWith('u1', 'password_reset');
  });

  it('a replayed reset after a successful reset still fails (the reset consumed the code)', async () => {
    await recovery.forgotPassword('bob@qc.test');
    const otp = emailedOtp();
    await recovery.resetPassword('bob@qc.test', otp, 'new-password');

    await expect(recovery.resetPassword('bob@qc.test', otp, 'evil-password')).rejects.toMatchObject(
      { status: 400, response: { code: 'OTP_INVALID' } },
    );
    expect(users.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('normalizes the email (trim + lower-case) for the lookup and every Redis key', async () => {
    await recovery.forgotPassword('  Bob@QC.test ');
    expect(users.findByEmail).toHaveBeenLastCalledWith('bob@qc.test');
    expect(store.get('forgot_otp_rate:bob@qc.test')).toBe('1');
    // The code is mailed to the address on file, not the typed variant.
    expect(mail.sendOtpEmail.mock.calls[0][0]).toBe('bob@qc.test');

    const otp = emailedOtp();
    await recovery.verifyOtp('BOB@qc.TEST', '000000' === otp ? '111111' : '000000').catch(() => {});
    expect(store.get('otp_attempts:bob@qc.test')).toBe('1');
    await recovery.verifyOtp('Bob@Qc.Test', otp);

    await recovery.resendOtp('BOB@QC.TEST').catch(() => {});
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
    await recovery.forgotPassword('bob@qc.test');
    const otp = emailedOtp();
    const wrong = otp === '123456' ? '654321' : '123456';
    for (let i = 0; i < 3; i++) {
      await recovery.verifyOtp('bob@qc.test', wrong).catch(() => {});
    }
    expect(store.get('otp_attempts:bob@qc.test')).toBe('3');

    await recovery.resendOtp('bob@qc.test');
    expect(store.get('otp_attempts:bob@qc.test')).toBe('3');

    await recovery.verifyOtp('bob@qc.test', wrong).catch(() => {});
    await recovery.verifyOtp('bob@qc.test', wrong).catch(() => {});
    // 6th guess overall → exceeded even though a new code was sent.
    await expect(recovery.verifyOtp('bob@qc.test', emailedOtp())).rejects.toMatchObject({
      response: { code: 'OTP_ATTEMPTS_EXCEEDED' },
    });
  });
});
