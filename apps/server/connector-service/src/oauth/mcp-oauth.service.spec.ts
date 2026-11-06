import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { McpOAuthService } from './mcp-oauth.service';
import { resolver } from '../security/url-guard';

function jsonRes(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('McpOAuthService', () => {
  let svc: McpOAuthService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    svc = new McpOAuthService();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(resolver, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('discoverMetadata', () => {
    it('follows protected-resource → authorization-server metadata', async () => {
      fetchMock
        // .well-known/oauth-protected-resource
        .mockResolvedValueOnce(
          jsonRes({ authorization_servers: ['https://auth.example.com'] }),
        )
        // .well-known/oauth-authorization-server
        .mockResolvedValueOnce(
          jsonRes({
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            registration_endpoint: 'https://auth.example.com/register',
          }),
        );

      const meta = await svc.discoverMetadata('https://mcp.example.com/mcp');
      expect(meta.authorizationEndpoint).toBe('https://auth.example.com/authorize');
      expect(meta.tokenEndpoint).toBe('https://auth.example.com/token');
      expect(meta.registrationEndpoint).toBe('https://auth.example.com/register');
      // protected-resource is fetched against the MCP origin
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://mcp.example.com/.well-known/oauth-protected-resource',
      );
    });

    it('falls back to the MCP origin as the auth server when no PRM doc', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonRes({}, false, 404)) // PRM missing
        .mockResolvedValueOnce(
          jsonRes({
            authorization_endpoint: 'https://mcp.example.com/authorize',
            token_endpoint: 'https://mcp.example.com/token',
            registration_endpoint: 'https://mcp.example.com/register',
          }),
        );
      const meta = await svc.discoverMetadata('https://mcp.example.com/mcp');
      expect(meta.tokenEndpoint).toBe('https://mcp.example.com/token');
    });

    it('throws when no AS metadata can be found', async () => {
      fetchMock.mockResolvedValue(jsonRes({}, false, 404));
      await expect(
        svc.discoverMetadata('https://mcp.example.com/mcp'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('registerClient (DCR)', () => {
    it('posts a public client and returns the issued client_id', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes({ client_id: 'cid-123' }));
      const client = await svc.registerClient(
        'https://auth.example.com/register',
        'https://cb/oauth/directory/x/callback',
        ['read'],
      );
      expect(client).toEqual({ clientId: 'cid-123', clientSecret: undefined });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.token_endpoint_auth_method).toBe('none');
      expect(body.redirect_uris).toEqual(['https://cb/oauth/directory/x/callback']);
      expect(body.scope).toBe('read');
    });

    it('throws when the registration response lacks a client_id', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes({}));
      await expect(
        svc.registerClient('https://auth/register', 'https://cb', []),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('PKCE', () => {
    it('generates a verifier and an S256 challenge derived from it', () => {
      const { verifier, challenge } = svc.generatePkce();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      const expected = createHash('sha256').update(verifier).digest('base64url');
      expect(challenge).toBe(expected);
    });
  });

  describe('buildAuthorizeUrl', () => {
    it('includes PKCE S256 + resource indicator', () => {
      const url = new URL(
        svc.buildAuthorizeUrl({
          authorizationEndpoint: 'https://auth.example.com/authorize',
          clientId: 'cid',
          redirectUri: 'https://cb/callback',
          state: 'state123',
          codeChallenge: 'chal',
          scopes: ['read', 'write'],
          resource: 'https://mcp.example.com/mcp',
        }),
      );
      expect(url.searchParams.get('client_id')).toBe('cid');
      expect(url.searchParams.get('code_challenge')).toBe('chal');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('resource')).toBe('https://mcp.example.com/mcp');
      expect(url.searchParams.get('scope')).toBe('read write');
    });
  });

  describe('exchangeCode', () => {
    it('sends code_verifier (PKCE) and computes expiry_date', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonRes({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
      );
      const before = Date.now();
      const tokens = await svc.exchangeCode({
        tokenEndpoint: 'https://auth.example.com/token',
        clientId: 'cid',
        code: 'code',
        codeVerifier: 'verifier',
        redirectUri: 'https://cb/callback',
        resource: 'https://mcp.example.com/mcp',
      });
      const sentBody = fetchMock.mock.calls[0][1].body as string;
      expect(sentBody).toContain('code_verifier=verifier');
      expect(sentBody).toContain('grant_type=authorization_code');
      expect(tokens.access_token).toBe('at');
      expect(tokens.expiry_date).toBeGreaterThanOrEqual(before + 3600 * 1000);
    });

    it('throws on a non-OK token response', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes({ error: 'bad' }, false, 400));
      await expect(
        svc.exchangeCode({
          tokenEndpoint: 'https://auth/token',
          clientId: 'cid',
          code: 'c',
          codeVerifier: 'v',
          redirectUri: 'https://cb',
          resource: 'https://mcp',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

describe('McpOAuthService — hostile / broken servers', () => {
  const realFetch = global.fetch;
  let svc: McpOAuthService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    svc = new McpOAuthService();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(resolver, 'lookup').mockImplementation(async (host: string) =>
      host.startsWith('internal') ? [{ address: '169.254.169.254', family: 4 }] : [{ address: '93.184.216.34', family: 4 }],
    );
    jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  const asMeta = (over: Record<string, unknown> = {}) => ({
    authorization_endpoint: 'https://auth.example.com/authorize',
    token_endpoint: 'https://auth.example.com/token',
    registration_endpoint: 'https://auth.example.com/register',
    scopes_supported: 'not-an-array',
    ...over,
  });
  const discoverWith = (meta: unknown) => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('oauth-authorization-server') ? jsonRes(meta) : jsonRes({}, false, 404),
    );
    return svc.discoverMetadata('https://mcp.example.com/mcp');
  };

  it.each([
    ['a token endpoint on a metadata IP (SSRF)', { token_endpoint: 'https://internal.example.com/token' }],
    ['a registration endpoint on a metadata IP', { registration_endpoint: 'https://internal.example.com/reg' }],
    ['a non-URL authorize endpoint', { authorization_endpoint: 'javascript:alert(1)' }],
  ])('rejects metadata with %s as OAUTH_DISCOVERY_FAILED', async (_l, over) => {
    await expect(discoverWith(asMeta(over))).rejects.toMatchObject({
      code: 'OAUTH_DISCOVERY_FAILED',
      response: expect.objectContaining({ reason: 'unsafe endpoint' }),
    });
  });

  it('ignores non-string registration / non-array scopes in metadata', async () => {
    const meta = await discoverWith(asMeta({ registration_endpoint: 42 }));
    expect(meta).toEqual({
      authorizationEndpoint: 'https://auth.example.com/authorize',
      tokenEndpoint: 'https://auth.example.com/token',
      registrationEndpoint: undefined,
      scopesSupported: undefined,
    });
  });

  it('treats metadata without string endpoints as missing', async () => {
    await expect(discoverWith({ authorization_endpoint: 1, token_endpoint: 'x' })).rejects.toMatchObject({
      code: 'OAUTH_DISCOVERY_FAILED',
    });
  });

  it('DCR: a non-OK answer is DCR_FAILED with the status only', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"invalid_redirect_uri"}' });
    const err = await svc.registerClient('https://auth.example.com/register', 'https://cb', []).catch((e) => e);
    expect(err).toMatchObject({ code: 'DCR_FAILED', response: expect.objectContaining({ status: 400 }) });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.token_endpoint_auth_method).toBe('none');
    expect(sent.scope).toBeUndefined();
  });

  it('DCR: keeps a confidential client secret, rejects a non-JSON answer', async () => {
    fetchMock.mockResolvedValueOnce(jsonRes({ client_id: 'cid', client_secret: 's3' }));
    expect(await svc.registerClient('https://auth.example.com/register', 'https://cb', ['a'])).toEqual({
      clientId: 'cid',
      clientSecret: 's3',
    });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => { throw new SyntaxError('html'); } });
    await expect(svc.registerClient('https://auth.example.com/register', 'https://cb', [])).rejects.toMatchObject({
      code: 'DCR_FAILED',
    });
  });

  it('DCR refuses to POST to an internal registration endpoint', async () => {
    await expect(svc.registerClient('https://internal.example.com/register', 'https://cb', [])).rejects.toMatchObject({ response: { code: 'UNSAFE_URL' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refresh posts the refresh grant (+ client secret when present) and keeps a given expiry_date', async () => {
    fetchMock.mockResolvedValue(jsonRes({ access_token: 'n', expires_in: 60, expiry_date: 123 }));
    const tokens = await svc.refresh({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'cid',
      clientSecret: 'sec',
      refreshToken: 'rt',
      resource: 'https://mcp.example.com/mcp',
    });
    expect(Object.fromEntries(new URLSearchParams(fetchMock.mock.calls[0][1].body))).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'rt',
      client_id: 'cid',
      client_secret: 'sec',
      resource: 'https://mcp.example.com/mcp',
    });
    expect(tokens.expiry_date).toBe(123);
  });

  it('a token answer without access_token is EXCHANGE_FAILED (invalid_response)', async () => {
    fetchMock.mockResolvedValue(jsonRes({ token_type: 'bearer' }));
    await expect(
      svc.refresh({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'c', refreshToken: 'r', resource: 'x' }),
    ).rejects.toMatchObject({ code: 'EXCHANGE_FAILED', oauthError: 'invalid_response' });
    expect(new URLSearchParams(fetchMock.mock.calls[0][1].body).has('client_secret')).toBe(false);
  });

  it('a non-OK token answer carries the RFC 6749 error code (invalid_grant)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"invalid_grant"}' });
    await expect(
      svc.refresh({ tokenEndpoint: 'https://auth.example.com/token', clientId: 'c', refreshToken: 'r', resource: 'x' }),
    ).rejects.toMatchObject({ code: 'EXCHANGE_FAILED', oauthError: 'invalid_grant' });
  });
});
