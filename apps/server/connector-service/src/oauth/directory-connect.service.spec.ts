import { ForbiddenException } from '@nestjs/common';
import { Capability } from '@platform/database';
import { DirectoryConnectService } from './directory-connect.service';

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
  let cfg: any, vault: any, mcpOAuth: any, directory: any, oauth: any, audit: any, connModel: any;

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
    directory = { findBySlug: jest.fn() };
    oauth = {
      signState: jest.fn().mockReturnValue('signed-state'),
      verifyState: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    connModel = { updateOne: jest.fn().mockResolvedValue({}) };
    svc = new DirectoryConnectService(cfg, vault, mcpOAuth, directory, oauth, audit, connModel);
  });

  it('mcp-oauth start: discovers, registers a DCR client, returns an authorize URL', async () => {
    directory.findBySlug.mockResolvedValue(entry());
    const res = await svc.start('acme', USER);
    expect(res).toEqual({ mode: 'oauth', authorizeUrl: 'https://auth/authorize?x=1' });
    expect(mcpOAuth.registerClient).toHaveBeenCalledWith(
      'https://auth/register',
      'https://cb/oauth/directory/acme/callback',
      [],
    );
    // the PKCE verifier + client creds are encrypted into the state, never raw
    expect(vault.encrypt).toHaveBeenCalled();
    expect(oauth.signState).toHaveBeenCalled();
  });

  it('mcp-oauth start: errors when the server does not support DCR', async () => {
    directory.findBySlug.mockResolvedValue(entry());
    mcpOAuth.discoverMetadata.mockResolvedValue({
      authorizationEndpoint: 'https://auth/authorize',
      tokenEndpoint: 'https://auth/token',
      // no registrationEndpoint
    });
    await expect(svc.start('acme', USER)).rejects.toThrow(/dynamic client registration/i);
  });

  it('apikey start: returns the apikey flag without persisting', async () => {
    directory.findBySlug.mockResolvedValue(entry({ authMode: 'apikey' }));
    const res = await svc.start('acme', USER);
    expect(res).toEqual({ mode: 'apikey' });
    expect(connModel.updateOne).not.toHaveBeenCalled();
  });

  it('none start: persists immediately and reports connected', async () => {
    directory.findBySlug.mockResolvedValue(entry({ authMode: 'none' }));
    const res = await svc.start('acme', USER);
    expect(res).toEqual({ mode: 'none', connected: true });
    expect(connModel.updateOne).toHaveBeenCalled();
  });

  it('workspace-tier connect requires CONNECT_WORKSPACE_CONNECTOR', async () => {
    directory.findBySlug.mockResolvedValue(entry({ tier: 'workspace' }));
    await expect(svc.start('acme', USER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('handleCallback exchanges the code and persists tokens + client creds', async () => {
    oauth.verifyState.mockReturnValue({
      userId: 'u1',
      provider: 'acme',
      scope: 'personal',
      enc: JSON.stringify({ iv: 'i', tag: 't', data: 'd' }),
    });
    vault.decrypt.mockReturnValue(
      JSON.stringify({
        codeVerifier: 'v',
        clientId: 'cid',
        tokenEndpoint: 'https://auth/token',
        mcpUrl: 'https://mcp.acme.com/mcp',
        redirectUri: 'https://cb/oauth/directory/acme/callback',
      }),
    );
    const redirect = await svc.handleCallback('acme', 'code', 'signed-state');
    expect(mcpOAuth.exchangeCode).toHaveBeenCalled();
    const update = connModel.updateOne.mock.calls[0][1].$set;
    expect(update.status).toBe('active');
    expect(update.directorySlug).toBe('acme');
    expect(update.tokenEndpoint).toBe('https://auth/token');
    expect(update.encryptedClientCreds).toBeDefined();
    expect(redirect).toContain('connected=acme');
  });

  it('handleCallback rejects a state/provider mismatch', async () => {
    oauth.verifyState.mockReturnValue({ userId: 'u1', provider: 'other', enc: '{}' });
    await expect(svc.handleCallback('acme', 'code', 's')).rejects.toThrow(/mismatch/i);
  });
});
