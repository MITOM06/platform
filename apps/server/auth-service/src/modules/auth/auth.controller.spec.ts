jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '@platform/database';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OidcService } from './oidc/oidc.service';
import { SsoMappingService } from './oidc/sso-mapping.service';
import { OAuthRedirectService } from './oauth-redirect.service';
import { InvitationAcceptService } from '../invitations/invitation-accept.service';
import { AuthCode } from '../../common/auth-code.enum';
import type { Response } from 'express';

const WEB = 'https://pon.example/oauth-callback';

async function buildController(overrides: {
  auth?: Record<string, unknown>;
  invitations?: Record<string, unknown>;
  oidc?: Record<string, unknown>;
}) {
  const redis = { set: jest.fn().mockResolvedValue('OK') };
  const module: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: overrides.auth ?? {} },
      {
        provide: ConfigService,
        useValue: {
          get: (k: string) => (k === 'WEB_REDIRECT_URL' ? WEB : undefined),
        },
      },
      { provide: OidcService, useValue: overrides.oidc ?? {} },
      { provide: SsoMappingService, useValue: {} },
      {
        provide: InvitationAcceptService,
        useValue: overrides.invitations ?? {},
      },
      OAuthRedirectService,
      { provide: REDIS_CLIENT, useValue: redis },
    ],
  }).compile();
  return { controller: module.get(AuthController), redis };
}

describe('AuthController — social login platform resolution', () => {
  let controller: AuthController;
  let handleSocialLogin: jest.Mock;

  beforeEach(async () => {
    handleSocialLogin = jest.fn();
    ({ controller } = await buildController({ auth: { handleSocialLogin } }));
  });

  const res = { clearCookie: jest.fn() } as unknown as Response;

  it('resolves platform from OAuth state when cookie is absent (web login)', async () => {
    // Real-world: the 60s oauth_platform cookie expired during Google consent,
    // so only the echoed-back `state` param carries the platform.
    const req = { user: { id: 'u1' }, query: { state: 'web' }, cookies: {} };

    await controller.googleCallback(req, res);

    expect(handleSocialLogin).toHaveBeenCalledWith(
      req.user,
      res,
      'google',
      'web',
    );
  });

  it('falls back to cookie when state is absent', async () => {
    const req = {
      user: { id: 'u1' },
      query: {},
      cookies: { oauth_platform: 'web' },
    };

    await controller.googleCallback(req, res);

    expect(handleSocialLogin).toHaveBeenCalledWith(
      req.user,
      res,
      'google',
      'web',
    );
  });

  it('defaults to mobile when neither state nor cookie present', async () => {
    const req = { user: { id: 'u1' }, query: {}, cookies: {} };

    await controller.googleCallback(req, res);

    expect(handleSocialLogin).toHaveBeenCalledWith(
      req.user,
      res,
      'google',
      'mobile',
    );
  });
});

describe('AuthController — social init redirect honours the public mount prefix', () => {
  let controller: AuthController;

  beforeEach(async () => {
    ({ controller } = await buildController({}));
  });

  function mockRes() {
    return {
      cookie: jest.fn(),
      redirect: jest.fn(),
    } as unknown as Response & { redirect: jest.Mock };
  }

  it('prefixes the redirect when a reverse proxy stripped the mount path', async () => {
    // The Mac mini serves auth-service under /api/auth and Caddy's handle_path
    // strips that before the request arrives, so a bare `/auth/google` bounces
    // the browser to a path the proxy does not route (404) instead of Google.
    const res = mockRes();
    const req = { params: { provider: 'google' }, headers: { 'x-forwarded-prefix': '/api/auth' } };

    await controller.initSocialLogin(req, res, 'web');

    expect(res.redirect).toHaveBeenCalledWith('/api/auth/auth/google?platform=web');
  });

  it('stays relative when the service is mounted at the host root', async () => {
    const res = mockRes();
    const req = { params: { provider: 'google' }, headers: {} };

    await controller.initSocialLogin(req, res, 'web');

    expect(res.redirect).toHaveBeenCalledWith('/auth/google?platform=web');
  });

  it('ignores a prefix that could redirect off-host', async () => {
    const res = mockRes();
    const req = {
      params: { provider: 'google' },
      headers: { 'x-forwarded-prefix': '//evil.example.com' },
    };

    await controller.initSocialLogin(req, res, 'web');

    expect(res.redirect).toHaveBeenCalledWith('/auth/google?platform=web');
  });
});

describe('AuthController — social login init (Google only)', () => {
  let controller: AuthController;
  let startGoogleFlow: jest.Mock;

  beforeEach(async () => {
    startGoogleFlow = jest.fn();
    ({ controller } = await buildController({
      invitations: { startGoogleFlow },
    }));
  });

  // Response giả: initSocialLogin chỉ dùng res.cookie và res.redirect.
  const makeRes = () => {
    const cookie = jest.fn();
    const redirect = jest.fn();
    const send = jest.fn();
    const res = { cookie, redirect, send } as unknown as Response;
    return { res, cookie, redirect, send };
  };

  it('redirects into the Google OAuth flow for provider "google"', async () => {
    const req = { params: { provider: 'google' } };
    const { res, cookie, redirect } = makeRes();

    await controller.initSocialLogin(req, res, 'web');

    expect(cookie).toHaveBeenCalledWith(
      'oauth_platform',
      'web',
      expect.any(Object),
    );
    expect(redirect).toHaveBeenCalledWith('/auth/google?platform=web');
    expect(startGoogleFlow).not.toHaveBeenCalled();
  });

  it('defaults platform to mobile when none is given', async () => {
    const req = { params: { provider: 'google' } };
    const { res, redirect } = makeRes();

    await controller.initSocialLogin(req, res, '');

    expect(redirect).toHaveBeenCalledWith('/auth/google?platform=mobile');
  });

  // Nhóm chỉ giữ đăng nhập Google: X/Twitter và Facebook bị chặn có chủ đích.
  it.each(['twitter', 'facebook', 'x'])(
    'rejects unsupported provider "%s" with 400 before touching the response',
    async (provider) => {
      const req = { params: { provider } };
      const { res, cookie, redirect } = makeRes();

      await expect(controller.initSocialLogin(req, res, 'web')).rejects.toThrow(
        BadRequestException,
      );
      expect(cookie).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    },
  );

  it('with a valid invite: carries only the flow id (never the token) into OAuth', async () => {
    startGoogleFlow.mockResolvedValue('flow_abcdefghijklmnop');
    const req = { params: { provider: 'google' } };
    const { res, redirect } = makeRes();

    await controller.initSocialLogin(
      req,
      res,
      'web',
      'RAW-INVITE-TOKEN-xxxxxxxxxxxx',
    );

    expect(startGoogleFlow).toHaveBeenCalledWith(
      'RAW-INVITE-TOKEN-xxxxxxxxxxxx',
    );
    expect(redirect).toHaveBeenCalledWith(
      '/auth/google?platform=web&flow=flow_abcdefghijklmnop',
    );
    expect(redirect.mock.calls[0][0]).not.toContain('RAW-INVITE-TOKEN');
  });

  it('with an invalid invite: error-redirects to the web client with the code', async () => {
    startGoogleFlow.mockRejectedValue(
      new GoneException({ code: AuthCode.INVITATION_EXPIRED }),
    );
    const req = { params: { provider: 'google' } };
    const { res, redirect, cookie } = makeRes();

    await controller.initSocialLogin(
      req,
      res,
      'web',
      'tok-xxxxxxxxxxxxxxxxxxxxxx',
    );

    expect(redirect).toHaveBeenCalledWith(`${WEB}?error=INVITATION_EXPIRED`);
    expect(cookie).not.toHaveBeenCalled();
  });

  it('with an invalid invite on mobile: serves the deep-link bridge with ?error=', async () => {
    startGoogleFlow.mockRejectedValue(
      new GoneException({ code: AuthCode.INVITATION_REVOKED }),
    );
    const req = { params: { provider: 'google' } };
    const { res, send } = makeRes();

    await controller.initSocialLogin(
      req,
      res,
      'mobile',
      'tok-xxxxxxxxxxxxxxxxxxxxxx',
    );

    const html = send.mock.calls[0][0] as string;
    expect(html).toContain('platform://auth?error=INVITATION_REVOKED');
    expect(html).toContain('intent://auth?error=INVITATION_REVOKED');
  });
});

describe('AuthController — Google callback (invite accept + error redirects)', () => {
  const makeRes = () => {
    const redirect = jest.fn();
    const send = jest.fn();
    const res = {
      redirect,
      send,
      clearCookie: jest.fn(),
    } as unknown as Response;
    return { res, redirect, send };
  };

  it('state "web.<flow>" routes to invite accept and redirects with a login code', async () => {
    const acceptWithGoogle = jest.fn().mockResolvedValue('new-user-id');
    const handleSocialLogin = jest.fn();
    const { controller, redis } = await buildController({
      invitations: { acceptWithGoogle },
      auth: { handleSocialLogin },
    });
    const { res, redirect } = makeRes();
    const req = {
      user: { id: 'g1', email: 'jane@acme.com' },
      query: { state: 'web.flow_abcdefghijklmnop' },
      cookies: {},
    };

    await controller.googleCallback(req, res);

    expect(acceptWithGoogle).toHaveBeenCalledWith(
      'flow_abcdefghijklmnop',
      req.user,
    );
    expect(handleSocialLogin).not.toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      'login_code:test-id',
      'new-user-id',
      'EX',
      300,
    );
    expect(redirect).toHaveBeenCalledWith(`${WEB}?code=test-id`);
  });

  it('email mismatch → ?error=INVITATION_EMAIL_MISMATCH (no JSON)', async () => {
    const acceptWithGoogle = jest
      .fn()
      .mockRejectedValue(
        new ForbiddenException({ code: AuthCode.INVITATION_EMAIL_MISMATCH }),
      );
    const { controller } = await buildController({
      invitations: { acceptWithGoogle },
    });
    const { res, redirect } = makeRes();

    await controller.googleCallback(
      { user: {}, query: { state: 'web.flow_abcdefghijklmnop' }, cookies: {} },
      res,
    );

    expect(redirect).toHaveBeenCalledWith(
      `${WEB}?error=INVITATION_EMAIL_MISMATCH`,
    );
  });

  it('plain login failure (not provisioned) → typed error redirect', async () => {
    const handleSocialLogin = jest
      .fn()
      .mockRejectedValue(
        new ForbiddenException({ code: AuthCode.ACCOUNT_NOT_PROVISIONED }),
      );
    const { controller } = await buildController({
      auth: { handleSocialLogin },
    });
    const { res, redirect } = makeRes();

    await controller.googleCallback(
      { user: {}, query: { state: 'web' }, cookies: {} },
      res,
    );

    expect(redirect).toHaveBeenCalledWith(
      `${WEB}?error=ACCOUNT_NOT_PROVISIONED`,
    );
  });

  it('unknown / untyped errors collapse to GENERIC_ERROR', async () => {
    const handleSocialLogin = jest
      .fn()
      .mockRejectedValue(new Error('boom: secret detail'));
    const { controller } = await buildController({
      auth: { handleSocialLogin },
    });
    const { res, redirect } = makeRes();

    await controller.googleCallback(
      { user: {}, query: { state: 'web' }, cookies: {} },
      res,
    );

    expect(redirect).toHaveBeenCalledWith(`${WEB}?error=GENERIC_ERROR`);
  });

  it('OIDC callback failure (non-AuthCode literal) → GENERIC_ERROR redirect', async () => {
    const handleCallback = jest
      .fn()
      .mockRejectedValue(new UnauthorizedException({ code: 'OIDC_BAD_STATE' }));
    const { controller } = await buildController({ oidc: { handleCallback } });
    const { res, redirect } = makeRes();

    await controller.oidcCallback({ query: {} }, res);

    expect(redirect).toHaveBeenCalledWith(`${WEB}?error=GENERIC_ERROR`);
  });

  it('OIDC SSO domain rejection keeps its code', async () => {
    const handleCallback = jest.fn().mockResolvedValue({
      platform: 'web',
      email: 'a@b.com',
      displayName: 'A',
      id: 's',
      groups: [],
    });
    const handleOidcLogin = jest
      .fn()
      .mockRejectedValue(
        new UnauthorizedException({ code: AuthCode.SSO_DOMAIN_NOT_ALLOWED }),
      );
    const { controller } = await buildController({
      oidc: { handleCallback },
      auth: { handleOidcLogin },
    });
    const { res, redirect } = makeRes();

    await controller.oidcCallback({ query: {} }, res);

    expect(redirect).toHaveBeenCalledWith(
      `${WEB}?error=SSO_DOMAIN_NOT_ALLOWED`,
    );
  });
});

describe('AuthController — logout revokes only the caller session', () => {
  it("uses the access token's sid and ignores a sid in the body (E2E: eve revoked carol's session)", async () => {
    const logout = jest.fn().mockResolvedValue({ success: true, code: 'LOGOUT_SUCCESS' });
    const { controller } = await buildController({ auth: { logout } });

    await controller.logout({
      user: { sub: 'eve', sid: 's-eve' },
      body: { sid: 's-carol' },
    });

    expect(logout).toHaveBeenCalledWith('eve', 's-eve');
  });
});

describe('AuthController — SSO email verification errors redirect with a typed code', () => {
  it.each([AuthCode.SSO_EMAIL_UNVERIFIED, AuthCode.SOCIAL_ACCOUNT_CONFLICT])(
    '%s is passed through to the client (not collapsed to GENERIC_ERROR)',
    async (code) => {
      const handleCallback = jest.fn().mockResolvedValue({
        platform: 'web',
        email: 'a@b.com',
        displayName: 'A',
        id: 's',
        groups: [],
        emailVerified: false,
      });
      const handleOidcLogin = jest
        .fn()
        .mockRejectedValue(new UnauthorizedException({ code }));
      const { controller } = await buildController({
        oidc: { handleCallback },
        auth: { handleOidcLogin },
      });
      const redirect = jest.fn();
      const res = { redirect, send: jest.fn(), clearCookie: jest.fn() } as unknown as Response;

      await controller.oidcCallback({ query: {} }, res);

      expect(redirect).toHaveBeenCalledWith(`${WEB}?error=${code}`);
    },
  );
});
