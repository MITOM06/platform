// nanoid is ESM-only (pulled in via OAuthRedirectService).
jest.mock('nanoid', () => ({ nanoid: () => 'test-id' }));

import {
  Controller,
  Get,
  INestApplication,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
} from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import request from 'supertest';
import { REDIS_CLIENT } from '@platform/database';
import { AuthController } from '../auth.controller';
import { OAuthRedirectService } from '../oauth-redirect.service';
import { GoogleStrategy } from '../strategies/google.strategy';
import { GoogleOAuthGuard } from './google-oauth.guard';
import { OAuthCallbackErrorFilter } from './oauth-callback-error.filter';

const WEB = 'http://web.test/oauth-callback';

/** Same decorators as AuthController.googleCallback, without its many deps. */
@Controller('auth')
class CallbackProbe {
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @UseFilters(OAuthCallbackErrorFilter)
  callback(@Res() res: Response) {
    res.json({ ok: true });
  }
}

/**
 * QC 2026-10-26: cancelling on Google's page, or a code Google refused, showed
 * the browser a raw `{"message":"Unauthorized","statusCode":401}` /
 * `{"statusCode":500,…}` page — the guard fails before the handler's own
 * redirect. Real passport + GoogleStrategy; only the call to Google is stubbed.
 */
describe('Google callback failures redirect with ?error= (never JSON)', () => {
  let app: INestApplication;
  let oauth2: { getOAuthAccessToken: jest.Mock };

  beforeEach(async () => {
    const env: Record<string, string> = {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_CALLBACK_URL: 'http://auth.test/auth/google/callback',
      WEB_REDIRECT_URL: WEB,
    };
    const mod = await Test.createTestingModule({
      controllers: [CallbackProbe],
      providers: [
        GoogleStrategy,
        OAuthRedirectService,
        OAuthCallbackErrorFilter,
        { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
        { provide: REDIS_CLIENT, useValue: {} },
      ],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    const strategy: unknown = mod.get(GoogleStrategy);
    oauth2 = (strategy as { _oauth2: typeof oauth2 })._oauth2;
    jest.spyOn(oauth2, 'getOAuthAccessToken');
  });
  afterEach(() => app.close());

  const callback = (query: string) =>
    request(app.getHttpServer()).get(`/auth/google/callback?${query}`);

  it('cancelled on Google → web /oauth-callback?error=SOCIAL_LOGIN_CANCELLED', async () => {
    const res = await callback('error=access_denied&state=web').expect(302);
    expect(res.headers.location).toBe(`${WEB}?error=SOCIAL_LOGIN_CANCELLED`);
  });

  it('cancelled during an invite accept → the same redirect', async () => {
    const res = await callback(
      'error=access_denied&state=web.abcdEFGH1234_-xyz',
    ).expect(302);
    expect(res.headers.location).toBe(`${WEB}?error=SOCIAL_LOGIN_CANCELLED`);
  });

  it('a code Google refuses (expired / reused) → SOCIAL_LOGIN_FAILED', async () => {
    oauth2.getOAuthAccessToken.mockImplementation(
      (_code: string, _params: unknown, cb: (err: unknown) => void) =>
        cb({
          statusCode: 400,
          data: '{"error":"invalid_grant","error_description":"Malformed auth code."}',
        }),
    );
    const res = await callback('code=used&state=web').expect(302);
    expect(res.headers.location).toBe(`${WEB}?error=SOCIAL_LOGIN_FAILED`);
  });

  it('any other provider error → SOCIAL_LOGIN_FAILED', async () => {
    const res = await callback('error=server_error&state=web').expect(302);
    expect(res.headers.location).toBe(`${WEB}?error=SOCIAL_LOGIN_FAILED`);
  });

  it('mobile gets the deep-link bridge page carrying the code', async () => {
    const res = await callback('error=access_denied&state=mobile').expect(200);
    expect(res.text).toContain('platform://auth?error=SOCIAL_LOGIN_CANCELLED');
    expect(res.text).not.toContain('statusCode');
  });

  it('a successful sign-in still reaches the handler', async () => {
    oauth2.getOAuthAccessToken.mockImplementation(
      (_code: string, _params: unknown, cb: (...a: unknown[]) => void) =>
        cb(null, 'access', 'refresh', {}),
    );
    type Done = (e: unknown, profile?: unknown) => void;
    const strategy: unknown = app.get(GoogleStrategy);
    jest
      .spyOn(
        strategy as { userProfile: (token: string, done: Done) => void },
        'userProfile',
      )
      .mockImplementation((_token, done) =>
        done(null, {
          id: 'g1',
          emails: [{ value: 'jane@acme.com', verified: true }],
        }),
      );
    await callback('code=good&state=web').expect(200, { ok: true });
  });

  it('AuthController.googleCallback is wired with this guard and filter', () => {
    // Only read for its decorator metadata, never called.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = AuthController.prototype.googleCallback;
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
      GoogleOAuthGuard,
    );
    expect(Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, handler)).toContain(
      OAuthCallbackErrorFilter,
    );
  });
});
