import { ForbiddenException } from '@nestjs/common';
import { Capability } from '@platform/database';
import { DirectoryConnectService } from './directory-connect.service';
import { OAuthFlowError } from './oauth-errors';
import { resolver } from '../security/url-guard';

const USER = { sub: 'u1', perms: [Capability.CONNECT_PERSONAL_CONNECTOR] } as any;

function entry(over: Record<string, any> = {}) {
  return {
    slug: 'acme',
    name: 'Acme',
    mcpUrl: 'https://mcp.acme.com/mcp',
    authMode: 'mcp-oauth',
    tier: 'both',
    scopes: [],
    available: true,
    ...over,
  };
}

describe('DirectoryConnectService', () => {
  let svc: DirectoryConnectService;
  let cfg: any, vault: any, mcpOAuth: any, directory: any, oauth: any, audit: any, store: any;

  beforeEach(() => {
    cfg = { get: jest.fn((k: string) => (k === 'oauthRedirectBase' ? 'https://cb' : 'https://web/integrations')) };
    vault = {
      encrypt: jest.fn().mockReturnValue({ iv: 'i', tag: 't', data: 'd' }),
      decrypt: jest.fn(),
    };
    mcpOAuth = {
      discoverMetadata: jest.fn().mockResolvedValue({
        authorizationEndpoint: 'https://auth/authorize',
        tokenEndpoint: 'https://auth/token',
        registrationEndpoint: 'https://auth/register',
      }),
      registerClient: jest.fn().mockResolvedValue({ clientId: 'cid' }),
      generatePkce: jest.fn().mockReturnValue({ verifier: 'v', challenge: 'c' }),
      buildAuthorizeUrl: jest.fn().mockReturnValue('https://auth/authorize?x=1'),
      exchangeCode: jest.fn().mockResolvedValue({ access_token: 'at', scope: 'read write' }),
    };
    directory = { findBySlug: jest.fn().mockResolvedValue(entry()) };
    oauth = {
      signState: jest.fn().mockReturnValue('signed-state'),
      verifyState: jest.fn(),
      authorizeTier: jest.fn().mockResolvedValue('personal'),
      recheckAtCallback: jest.fn().mockResolvedValue(undefined),
      redirectConnected: jest.fn((p: string) => `https://web/integrations?connected=${p}`),
      redirectError: jest.fn((code: string, p: string) => `https://web/integrations?error=${code}&provider=${p}`),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    store = { upsert: jest.fn().mockResolvedValue(undefined) };
    svc = new DirectoryConnectService(cfg, vault, mcpOAuth, directory, oauth, store, audit);
    jest.spyOn(resolver, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  afterEach(() => jest.restoreAllMocks());

  const validState = () =>
    oauth.verifyState.mockReturnValue({
      userId: 'u1',
      provider: 'acme',
      scope: 'personal',
      enc: JSON.stringify({ iv: 'i', tag: 't', data: 'd' }),
    });
  const flowSecret = () =>
    vault.decrypt.mockReturnValue(
      JSON.stringify({
        codeVerifier: 'v',
        clientId: 'cid',
        tokenEndpoint: 'https://auth/token',
        mcpUrl: 'https://mcp.acme.com/mcp',
        redirectUri: 'https://cb/oauth/directory/acme/callback',
      }),
    );

  it('mcp-oauth start: discovers, registers a DCR client, returns an authorize URL', async () => {
    const res = await svc.start('acme', USER);
    expect(res).toEqual({ mode: 'oauth', authorizeUrl: 'https://auth/authorize?x=1' });
    expect(oauth.authorizeTier).toHaveBeenCalledWith('both', 'acme', USER);
    expect(mcpOAuth.registerClient).toHaveBeenCalledWith(
      'https://auth/register',
      'https://cb/oauth/directory/acme/callback',
      [],
    );
    // the PKCE verifier + client creds are encrypted into the state, never raw
    expect(vault.encrypt).toHaveBeenCalled();
    expect(oauth.signState).toHaveBeenCalled();
  });

  it('mcp-oauth start: errors with a code when the server does not support DCR', async () => {
    mcpOAuth.discoverMetadata.mockResolvedValue({
      authorizationEndpoint: 'https://auth/authorize',
      tokenEndpoint: 'https://auth/token',
    });
    await expect(svc.start('acme', USER)).rejects.toMatchObject({ code: 'DCR_UNSUPPORTED' });
  });

  it('a blocked catalog id (allow-list) cannot be connected through the directory', async () => {
    directory.findBySlug.mockResolvedValue(entry({ slug: 'notion' }));
    oauth.authorizeTier.mockRejectedValue(new ForbiddenException({ code: 'CONNECTOR_NOT_ALLOWED' }));
    await expect(svc.start('notion', USER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mcpOAuth.discoverMetadata).not.toHaveBeenCalled();
  });

  it('env-oauth start refuses an entry that references a non-allow-listed env var', async () => {
    directory.findBySlug.mockResolvedValue(
      entry({
        authMode: 'env-oauth',
        envClientIdName: 'JWT_ACCESS_SECRET',
        envClientSecretName: 'CONNECTOR_VAULT_KEY',
        authorizeUrl: 'https://evil.example.com/authorize',
        tokenUrl: 'https://evil.example.com/token',
      }),
    );
    await expect(svc.start('acme', USER)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_ENV_OAUTH' }),
    });
    expect(oauth.signState).not.toHaveBeenCalled();
  });

  it('apikey start: returns the apikey flag without persisting', async () => {
    directory.findBySlug.mockResolvedValue(entry({ authMode: 'apikey' }));
    expect(await svc.start('acme', USER)).toEqual({ mode: 'apikey' });
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('none start: persists immediately and reports connected', async () => {
    directory.findBySlug.mockResolvedValue(entry({ authMode: 'none' }));
    expect(await svc.start('acme', USER)).toEqual({ mode: 'none', connected: true });
    expect(store.upsert).toHaveBeenCalledWith(expect.objectContaining({ provider: 'acme', scope: 'personal' }));
  });

  it('workspace-tier connect requires CONNECT_WORKSPACE_CONNECTOR', async () => {
    directory.findBySlug.mockResolvedValue(entry({ tier: 'workspace' }));
    oauth.authorizeTier.mockRejectedValue(new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION' }));
    await expect(svc.start('acme', USER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('handleCallback exchanges the code and persists a coherent directory record', async () => {
    validState();
    flowSecret();
    const redirect = await svc.handleCallback('acme', 'code', 'signed-state');
    expect(mcpOAuth.exchangeCode).toHaveBeenCalled();
    expect(oauth.recheckAtCallback).toHaveBeenCalledWith('u1', 'acme', 'personal');
    const write = store.upsert.mock.calls[0][0];
    expect(write.set.directorySlug).toBe('acme');
    expect(write.set.tokenEndpoint).toBe('https://auth/token');
    expect(write.set.encryptedClientCreds).toBeDefined();
    expect(write.unset).toContain('accountLabel');
    expect(redirect).toBe('https://web/integrations?connected=acme');
  });

  it('handleCallback redirects with STATE_INVALID on a state/provider mismatch (no throw)', async () => {
    oauth.verifyState.mockReturnValue({ userId: 'u1', provider: 'other', enc: '{}' });
    const url = await svc.handleCallback('acme', 'code', 's');
    expect(url).toBe('https://web/integrations?error=STATE_INVALID&provider=acme');
    expect(mcpOAuth.exchangeCode).not.toHaveBeenCalled();
  });

  it('handleCallback maps an expired state, a provider denial and an exchange failure to codes', async () => {
    oauth.verifyState.mockImplementation(() => {
      throw new OAuthFlowError('STATE_EXPIRED');
    });
    expect(await svc.handleCallback('acme', 'code', 's')).toContain('error=STATE_EXPIRED');

    validState();
    expect(await svc.handleCallback('acme', '', 's', 'access_denied')).toContain('error=ACCESS_DENIED');

    flowSecret();
    mcpOAuth.exchangeCode.mockRejectedValue(new OAuthFlowError('EXCHANGE_FAILED', { status: 400 }));
    const url = await svc.handleCallback('acme', 'code', 's');
    expect(url).toBe('https://web/integrations?error=EXCHANGE_FAILED&provider=acme');
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('handleCallback refuses when the allow-list changed mid-flow', async () => {
    validState();
    flowSecret();
    oauth.recheckAtCallback.mockRejectedValue(new ForbiddenException({ code: 'CONNECTOR_NOT_ALLOWED' }));
    expect(await svc.handleCallback('acme', 'code', 's')).toContain('error=CONNECTOR_NOT_ALLOWED');
    expect(mcpOAuth.exchangeCode).not.toHaveBeenCalled();
  });

  // ── Start: edge + security cases ───────────────────────────────────────

  it.each([
    ['unknown', null],
    ['disabled', entry({ available: false })],
  ])('start refuses an %s directory entry with CONNECTOR_UNAVAILABLE', async (_label, found) => {
    directory.findBySlug.mockResolvedValue(found);
    await expect(svc.start('acme', USER)).rejects.toMatchObject({
      response: { code: 'CONNECTOR_UNAVAILABLE', provider: 'acme' },
    });
    expect(oauth.authorizeTier).not.toHaveBeenCalled();
  });

  it('start refuses an unknown auth mode', async () => {
    directory.findBySlug.mockResolvedValue(entry({ authMode: 'magic' }));
    await expect(svc.start('acme', USER)).rejects.toMatchObject({ response: { code: 'UNSUPPORTED_AUTH_MODE' } });
  });

  it('mcp-oauth: the state carries the user + scope and ONLY a vault-encrypted secret (verifier, client creds)', async () => {
    oauth.authorizeTier.mockResolvedValue('workspace');
    mcpOAuth.registerClient.mockResolvedValue({ clientId: 'cid', clientSecret: 'dcr-secret' });
    mcpOAuth.discoverMetadata.mockResolvedValue({
      authorizationEndpoint: 'https://auth/authorize',
      tokenEndpoint: 'https://auth/token',
      registrationEndpoint: 'https://auth/register',
      scopesSupported: ['read', 'write'],
    });
    await svc.start('acme', USER);

    const plaintext = JSON.parse(vault.encrypt.mock.calls[0][0]);
    expect(plaintext).toEqual({
      codeVerifier: 'v',
      clientId: 'cid',
      clientSecret: 'dcr-secret',
      tokenEndpoint: 'https://auth/token',
      mcpUrl: 'https://mcp.acme.com/mcp',
      redirectUri: 'https://cb/oauth/directory/acme/callback',
    });
    const statePayload = oauth.signState.mock.calls[0][0];
    expect(statePayload).toEqual({
      userId: 'u1',
      provider: 'acme',
      scope: 'workspace',
      enc: JSON.stringify({ iv: 'i', tag: 't', data: 'd' }),
    });
    expect(JSON.stringify(statePayload)).not.toContain('dcr-secret');
    expect(JSON.stringify(statePayload)).not.toContain('"v"');
    // only the S256 challenge goes to the browser, and the server's scopes are used when the entry has none
    expect(mcpOAuth.buildAuthorizeUrl).toHaveBeenCalledWith({
      authorizationEndpoint: 'https://auth/authorize',
      clientId: 'cid',
      redirectUri: 'https://cb/oauth/directory/acme/callback',
      state: 'signed-state',
      codeChallenge: 'c',
      scopes: ['read', 'write'],
      resource: 'https://mcp.acme.com/mcp',
    });
  });

  it('mcp-oauth: entry scopes win over the server-advertised ones', async () => {
    directory.findBySlug.mockResolvedValue(entry({ scopes: ['only-this'] }));
    await svc.start('acme', USER);
    expect(mcpOAuth.registerClient.mock.calls[0][2]).toEqual(['only-this']);
    expect(mcpOAuth.buildAuthorizeUrl.mock.calls[0][0].scopes).toEqual(['only-this']);
  });

  describe('env-oauth', () => {
    const envEntry = (over: Record<string, any> = {}) =>
      entry({
        authMode: 'env-oauth',
        envClientIdName: 'OAUTH_ACME_CLIENT_ID',
        envClientSecretName: 'OAUTH_ACME_CLIENT_SECRET',
        authorizeUrl: 'https://login.acme.com/authorize',
        tokenUrl: 'https://login.acme.com/token',
        scopes: ['read'],
        ...over,
      });
    afterEach(() => {
      delete process.env.OAUTH_ACME_CLIENT_ID;
      delete process.env.OAUTH_ACME_CLIENT_SECRET;
    });

    it('builds the authorize URL from the allow-listed env credentials', async () => {
      process.env.OAUTH_ACME_CLIENT_ID = 'env-cid';
      process.env.OAUTH_ACME_CLIENT_SECRET = 'env-secret';
      directory.findBySlug.mockResolvedValue(envEntry());
      expect(await svc.start('acme', USER)).toEqual({ mode: 'oauth', authorizeUrl: 'https://auth/authorize?x=1' });
      expect(mcpOAuth.discoverMetadata).not.toHaveBeenCalled();
      expect(JSON.parse(vault.encrypt.mock.calls[0][0])).toMatchObject({
        clientId: 'env-cid',
        clientSecret: 'env-secret',
        tokenEndpoint: 'https://login.acme.com/token',
      });
      expect(mcpOAuth.buildAuthorizeUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationEndpoint: 'https://login.acme.com/authorize',
          clientId: 'env-cid',
          scopes: ['read'],
        }),
      );
      // the client secret never goes into the browser-facing URL builder
      expect(JSON.stringify(mcpOAuth.buildAuthorizeUrl.mock.calls[0][0])).not.toContain('env-secret');
    });

    it('works without a client secret (public client) and without entry scopes', async () => {
      process.env.OAUTH_ACME_CLIENT_ID = 'env-cid';
      directory.findBySlug.mockResolvedValue(envEntry({ envClientSecretName: undefined, scopes: undefined }));
      await svc.start('acme', USER);
      expect(JSON.parse(vault.encrypt.mock.calls[0][0]).clientSecret).toBeUndefined();
      expect(mcpOAuth.buildAuthorizeUrl.mock.calls[0][0].scopes).toEqual([]);
    });

    it('refuses when the env client id is not configured on the server', async () => {
      directory.findBySlug.mockResolvedValue(envEntry());
      await expect(svc.start('acme', USER)).rejects.toMatchObject({ response: { code: 'ENV_OAUTH_NOT_CONFIGURED' } });
      expect(oauth.signState).not.toHaveBeenCalled();
    });

    it('refuses a token URL that resolves to a private address (SSRF, client secret would be POSTed there)', async () => {
      process.env.OAUTH_ACME_CLIENT_ID = 'env-cid';
      (resolver.lookup as jest.Mock).mockImplementation(async (host: string) =>
        host === 'login.acme.com' ? [{ address: '10.0.0.5', family: 4 }] : [{ address: '93.184.216.34', family: 4 }],
      );
      directory.findBySlug.mockResolvedValue(envEntry());
      await expect(svc.start('acme', USER)).rejects.toMatchObject({ response: { code: 'UNSAFE_URL' } });
      expect(oauth.signState).not.toHaveBeenCalled();
    });
  });

  // ── Callback: CSRF / state tampering ───────────────────────────────────

  it('a callback without code (and without provider error) → MISSING_CODE, nothing persisted', async () => {
    validState();
    expect(await svc.handleCallback('acme', '', 's')).toBe('https://web/integrations?error=MISSING_CODE&provider=acme');
    expect(await svc.handleCallback('acme', ['a', 'b'] as any, 's')).toContain('error=MISSING_CODE');
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('any other provider error → PROVIDER_ERROR (raw provider text never echoed)', async () => {
    validState();
    const url = await svc.handleCallback('acme', 'code', 's', '<script>alert(1)</script>');
    expect(url).toBe('https://web/integrations?error=PROVIDER_ERROR&provider=acme');
  });

  it('a provider error with a FORGED state is reported as STATE_INVALID (state checked first)', async () => {
    oauth.verifyState.mockImplementation(() => {
      throw new OAuthFlowError('STATE_INVALID');
    });
    expect(await svc.handleCallback('acme', 'code', 'forged', 'access_denied')).toContain('error=STATE_INVALID');
  });

  it('a state without the encrypted secret → STATE_INVALID', async () => {
    oauth.verifyState.mockReturnValue({ userId: 'u1', provider: 'acme', scope: 'personal' });
    expect(await svc.handleCallback('acme', 'code', 's')).toContain('error=STATE_INVALID');
    expect(mcpOAuth.exchangeCode).not.toHaveBeenCalled();
  });

  it.each([
    ['not JSON', 'not-json', undefined],
    ['undecryptable', JSON.stringify({ iv: 'x' }), () => { throw new Error('bad auth tag'); }],
    ['decrypts to garbage', JSON.stringify({ iv: 'x' }), () => '{oops'],
  ])('a tampered secret (%s) → STATE_INVALID, never INTERNAL_ERROR', async (_l, enc, decrypt) => {
    oauth.verifyState.mockReturnValue({ userId: 'u1', provider: 'acme', scope: 'personal', enc });
    if (decrypt) vault.decrypt.mockImplementation(decrypt);
    expect(await svc.handleCallback('acme', 'code', 's')).toBe('https://web/integrations?error=STATE_INVALID&provider=acme');
    expect(mcpOAuth.exchangeCode).not.toHaveBeenCalled();
  });

  it('the entry being disabled mid-flow → CONNECTOR_UNAVAILABLE, no exchange', async () => {
    validState();
    flowSecret();
    directory.findBySlug.mockResolvedValue(entry({ available: false }));
    expect(await svc.handleCallback('acme', 'code', 's')).toContain('error=CONNECTOR_UNAVAILABLE');
    expect(mcpOAuth.exchangeCode).not.toHaveBeenCalled();
  });

  it('any scope other than "workspace" in the state is treated as personal', async () => {
    oauth.verifyState.mockReturnValue({ userId: 'u1', provider: 'acme', scope: 'admin', enc: '{}' });
    flowSecret();
    await svc.handleCallback('acme', 'code', 's');
    expect(oauth.recheckAtCallback).toHaveBeenCalledWith('u1', 'acme', 'personal');
    expect(store.upsert.mock.calls[0][0].scope).toBe('personal');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('exchanges with the PKCE verifier + redirect URI from the encrypted state, stores tokens/creds only encrypted', async () => {
    oauth.verifyState.mockReturnValue({ userId: 'u1', provider: 'acme', scope: 'workspace', enc: '{}' });
    vault.decrypt.mockReturnValue(
      JSON.stringify({
        codeVerifier: 'verifier-123',
        clientId: 'cid',
        clientSecret: 'csec',
        tokenEndpoint: 'https://auth/token',
        mcpUrl: 'https://mcp.acme.com/mcp',
        redirectUri: 'https://cb/oauth/directory/acme/callback',
      }),
    );
    vault.encrypt.mockImplementation((plain: string) => ({ sealed: plain.length }));
    await svc.handleCallback('acme', 'the-code', 's');
    expect(mcpOAuth.exchangeCode).toHaveBeenCalledWith({
      tokenEndpoint: 'https://auth/token',
      clientId: 'cid',
      clientSecret: 'csec',
      code: 'the-code',
      codeVerifier: 'verifier-123',
      redirectUri: 'https://cb/oauth/directory/acme/callback',
      resource: 'https://mcp.acme.com/mcp',
    });
    const write = store.upsert.mock.calls[0][0];
    expect(write).toMatchObject({ userId: 'u1', provider: 'acme', scope: 'workspace' });
    expect(write.set.scopes).toEqual(['read', 'write']);
    expect(JSON.stringify(write)).not.toContain('csec');
    expect(JSON.stringify(write)).not.toContain('"at"');
    expect(vault.encrypt).toHaveBeenCalledWith(JSON.stringify({ client_id: 'cid', client_secret: 'csec' }));
    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'u1',
      action: 'connector.connect',
      targetType: 'connector',
      targetId: 'acme',
      meta: { scope: 'workspace', directory: true },
    });
  });

  it('a token answer without scope stores []', async () => {
    validState();
    flowSecret();
    mcpOAuth.exchangeCode.mockResolvedValue({ access_token: 'at' });
    await svc.handleCallback('acme', 'code', 's');
    expect(store.upsert.mock.calls[0][0].set.scopes).toEqual([]);
  });

  it('an unexpected failure is logged and redirected as INTERNAL_ERROR (never thrown)', async () => {
    const log = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    validState();
    flowSecret();
    store.upsert.mockRejectedValue(new Error('mongo down'));
    expect(await svc.handleCallback('acme', 'code', 's')).toBe('https://web/integrations?error=INTERNAL_ERROR&provider=acme');
    expect(log).toHaveBeenCalled();
  });

  // ── Apikey connect ─────────────────────────────────────────────────────

  it('connectWithKey stores the key only vault-encrypted and clears OAuth-only fields', async () => {
    directory.findBySlug.mockResolvedValue(entry({ authMode: 'apikey', scopes: ['s'] }));
    vault.encrypt.mockReturnValue({ iv: 'i', tag: 't', data: 'sealed' });
    expect(await svc.connectWithKey('acme', USER, 'sk_live_123')).toEqual({ connected: true });
    expect(vault.encrypt).toHaveBeenCalledWith(JSON.stringify({ access_token: 'sk_live_123' }));
    const write = store.upsert.mock.calls[0][0];
    expect(JSON.stringify(write)).not.toContain('sk_live_123');
    expect(write).toMatchObject({
      userId: 'u1',
      provider: 'acme',
      scope: 'personal',
      set: { scopes: ['s'], mcpUrl: 'https://mcp.acme.com/mcp', directorySlug: 'acme' },
    });
    expect(write.unset).toEqual(expect.arrayContaining(['tokenEndpoint', 'encryptedClientCreds', 'accountLabel']));
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('connectWithKey refuses a non-apikey entry before any tier/permission check', async () => {
    await expect(svc.connectWithKey('acme', USER, 'k')).rejects.toMatchObject({
      response: { code: 'NOT_AN_APIKEY_CONNECTOR' },
    });
    expect(oauth.authorizeTier).not.toHaveBeenCalled();
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('connectWithKey audits a workspace connect and obeys the tier check', async () => {
    directory.findBySlug.mockResolvedValue(entry({ authMode: 'apikey', scopes: undefined }));
    oauth.authorizeTier.mockResolvedValueOnce('workspace');
    await svc.connectWithKey('acme', USER, 'k');
    expect(store.upsert.mock.calls[0][0].set.scopes).toEqual([]);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'connector.connect', targetId: 'acme' }));
    oauth.authorizeTier.mockRejectedValueOnce(new ForbiddenException({ code: 'INSUFFICIENT_PERMISSION' }));
    await expect(svc.connectWithKey('acme', USER, 'k')).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.upsert).toHaveBeenCalledTimes(1);
  });

  it('none connect in workspace scope is audited and stores an empty token', async () => {
    directory.findBySlug.mockResolvedValue(entry({ authMode: 'none', scopes: undefined }));
    oauth.authorizeTier.mockResolvedValue('workspace');
    await svc.start('acme', USER);
    expect(vault.encrypt).toHaveBeenCalledWith(JSON.stringify({ access_token: '' }));
    const write = store.upsert.mock.calls[0][0];
    expect(write.set.scopes).toEqual([]);
    expect(write.unset).not.toContain('directorySlug');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ meta: { scope: 'workspace', directory: true } }));
  });
});
