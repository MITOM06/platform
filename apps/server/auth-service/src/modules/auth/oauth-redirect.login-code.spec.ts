jest.mock('nanoid', () => ({ nanoid: () => 'code-1' }));

import { ConfigService } from '@nestjs/config';
import { OAuthRedirectService, parseLoginCode } from './oauth-redirect.service';

describe('login-code grant (2FA applies to Google, not to OIDC SSO)', () => {
  it('stores who signed in and how', async () => {
    const redis = { set: jest.fn().mockResolvedValue('OK') };
    const svc = new OAuthRedirectService(
      { get: () => undefined } as unknown as ConfigService,
      redis as never,
    );
    await svc.createLoginCode('u1');
    await svc.createLoginCode('u2', 'oidc');
    expect(redis.set).toHaveBeenNthCalledWith(
      1,
      'login_code:code-1',
      '{"userId":"u1","via":"google"}',
      'EX',
      300,
    );
    expect(redis.set).toHaveBeenNthCalledWith(
      2,
      'login_code:code-1',
      '{"userId":"u2","via":"oidc"}',
      'EX',
      300,
    );
  });

  it('parses JSON grants and legacy bare-userId values', () => {
    expect(parseLoginCode('{"userId":"u1","via":"oidc"}')).toEqual({
      userId: 'u1',
      via: 'oidc',
    });
    expect(parseLoginCode('{"userId":"u1","via":"google"}')).toEqual({
      userId: 'u1',
      via: 'google',
    });
    // Minted before 2FA shipped (≤ 5 min old): no "via" → treated as Google, 2FA applies.
    expect(parseLoginCode('64b0000000000000000000a1')).toEqual({
      userId: '64b0000000000000000000a1',
    });
    expect(parseLoginCode('{"userId":"u1","via":"magic"}')).toEqual({
      userId: 'u1',
      via: undefined,
    });
  });

  it('rejects empty / malformed values', () => {
    expect(parseLoginCode(null)).toBeNull();
    expect(parseLoginCode('')).toBeNull();
    expect(parseLoginCode('{not json')).toBeNull();
    expect(parseLoginCode('{"via":"oidc"}')).toBeNull();
  });
});
