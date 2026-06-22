jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OidcService } from './oidc/oidc.service';
import { SsoMappingService } from './oidc/sso-mapping.service';
import type { Response } from 'express';

describe('AuthController — social login platform resolution', () => {
  let controller: AuthController;
  let handleSocialLogin: jest.Mock;

  beforeEach(async () => {
    handleSocialLogin = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { handleSocialLogin } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: OidcService, useValue: {} },
        { provide: SsoMappingService, useValue: {} },
      ],
    }).compile();

    controller = module.get(AuthController);
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
