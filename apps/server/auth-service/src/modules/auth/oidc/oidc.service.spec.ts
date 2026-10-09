const mockClient = {
  authorizationUrl: jest.fn(() => 'https://idp.example.com/authorize?x=1'),
  callback: jest.fn(async () => ({
    claims: () => ({
      email: 'alice@acme.com',
      email_verified: true,
      name: 'Alice',
      sub: 'sub-123',
      groups: ['pon-admins'],
    }),
  })),
  callbackParams: jest.fn(() => ({ code: 'c', state: 's' })),
};
jest.mock('openid-client', () => ({
  Issuer: {
    discover: jest.fn(async () => ({
      Client: function () {
        return mockClient;
      },
    })),
  },
  generators: {
    codeVerifier: () => 'verifier',
    codeChallenge: () => 'challenge',
    state: () => 'state-abc',
    nonce: () => 'nonce-xyz',
  },
}));

import { Issuer } from 'openid-client';
import { OidcService } from './oidc.service';

function makeService(redisStore: Record<string, string>) {
  const redis = {
    set: jest.fn(async (k: string, v: string) => {
      redisStore[k] = v;
    }),
    get: jest.fn(async (k: string) => redisStore[k] ?? null),
    del: jest.fn(async (k: string) => {
      delete redisStore[k];
    }),
  };
  const config = {
    get: (k: string) =>
      ({
        OIDC_ENABLED: 'true',
        OIDC_ISSUER: 'https://idp.example.com',
        OIDC_CLIENT_ID: 'cid',
        OIDC_CLIENT_SECRET: 'secret',
        OIDC_REDIRECT_URI: 'https://pon.acme.com/api/auth/oidc/callback',
        OIDC_SCOPES: 'openid email profile groups',
        OIDC_GROUPS_CLAIM: 'groups',
      })[k],
  };
  return new OidcService(config as any, redis as any);
}

describe('OidcService', () => {
  it('isEnabledByEnv true when env present', () => {
    expect(makeService({}).isEnabledByEnv()).toBe(true);
  });

  it('buildAuthorizeUrl stores flow state and returns the IdP url', async () => {
    const store: Record<string, string> = {};
    const svc = makeService(store);
    const url = await svc.buildAuthorizeUrl('web');
    expect(url).toContain('https://idp.example.com/authorize');
    const flow = JSON.parse(store['oidc:flow:state-abc']);
    expect(flow).toMatchObject({
      codeVerifier: 'verifier',
      nonce: 'nonce-xyz',
      platform: 'web',
    });
  });

  it('handleCallback validates and returns the normalized profile (with platform)', async () => {
    const store: Record<string, string> = {
      'oidc:flow:state-abc': JSON.stringify({
        codeVerifier: 'verifier',
        nonce: 'nonce-xyz',
        platform: 'web',
      }),
    };
    const svc = makeService(store);
    const profile = await svc.handleCallback({ code: 'c', state: 'state-abc' });
    expect(profile).toEqual({
      email: 'alice@acme.com',
      displayName: 'Alice',
      id: 'sub-123',
      groups: ['pon-admins'],
      platform: 'web',
    });
    expect(store['oidc:flow:state-abc']).toBeUndefined(); // one-time
  });

  it('handleCallback rejects an unknown state', async () => {
    await expect(
      makeService({}).handleCallback({ code: 'c', state: 'nope' }),
    ).rejects.toThrow();
  });

  it('handleCallback rejects an unverified email', async () => {
    mockClient.callback.mockResolvedValueOnce({
      claims: () => ({
        email: 'bob@acme.com',
        email_verified: false,
        sub: 's',
        groups: [],
      }),
    } as any);
    const store: Record<string, string> = {
      'oidc:flow:state-abc': JSON.stringify({
        codeVerifier: 'v',
        nonce: 'n',
        platform: 'web',
      }),
    };
    await expect(
      makeService(store).handleCallback({ code: 'c', state: 'state-abc' }),
    ).rejects.toThrow();
  });

  describe('discovery failures (IdP down)', () => {
    const discover = Issuer.discover as unknown as jest.Mock;

    it('answers 503 SSO_UNAVAILABLE and retries on the next request (failure not cached)', async () => {
      const svc = makeService({});
      discover.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
      await expect(svc.buildAuthorizeUrl('web')).rejects.toMatchObject({
        status: 503,
        response: { code: 'SSO_UNAVAILABLE' },
      });
      const calls = discover.mock.calls.length;
      // IdP back: the very next request discovers again and succeeds.
      await expect(svc.buildAuthorizeUrl('web')).resolves.toContain(
        'https://idp.example.com/authorize',
      );
      expect(discover.mock.calls.length).toBe(calls + 1);
    });

    it('a successful discovery is cached', async () => {
      const svc = makeService({});
      await svc.buildAuthorizeUrl('web');
      const calls = discover.mock.calls.length;
      await svc.buildAuthorizeUrl('mobile');
      expect(discover.mock.calls.length).toBe(calls);
    });

    it('the callback also maps a failed discovery to SSO_UNAVAILABLE', async () => {
      const store: Record<string, string> = {
        'oidc:flow:state-abc': JSON.stringify({
          codeVerifier: 'v',
          nonce: 'n',
          platform: 'web',
        }),
      };
      discover.mockRejectedValueOnce(new Error('timeout'));
      await expect(
        makeService(store).handleCallback({ code: 'c', state: 'state-abc' }),
      ).rejects.toMatchObject({ response: { code: 'SSO_UNAVAILABLE' } });
    });
  });
});
