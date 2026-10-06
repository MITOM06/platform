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
});
