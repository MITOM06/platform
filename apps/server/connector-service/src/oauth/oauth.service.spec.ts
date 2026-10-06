import { ForbiddenException } from '@nestjs/common';
import { Capability } from '@platform/database';
import { OAuthService } from './oauth.service';
import { findCatalogEntry } from '../catalog/catalog';
import { ConnectorPolicyService } from '../governance/connector-policy.service';

function makeService(workspace?: any, memberPerms: string[] = [Capability.CONNECT_PERSONAL_CONNECTOR]) {
  const cfg = {
    get: (k: string) =>
      ({
        internalApiKey: 'internal-secret',
        oauthRedirectBase: 'http://localhost:3003',
        clientRedirectUrl: 'http://localhost:3000/integrations',
      })[k],
  } as any;
  const wsModel = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(workspace === undefined ? { connectorAllowList: ['notion'] } : workspace),
    }),
  };
  const policy = new ConnectorPolicyService(wsModel as any, {} as any, {} as any);
  const perms = {
    resolveMember: jest.fn().mockResolvedValue({ exists: true, active: true, perms: new Set(memberPerms) }),
  };
  const store = { upsert: jest.fn().mockResolvedValue(undefined) };
  const vault = { encrypt: jest.fn().mockReturnValue({ iv: 'i', tag: 't', data: 'd' }) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const svc = new OAuthService(cfg, vault as any, store as any, policy, perms as any, audit as any);
  return { svc, store, perms, audit };
}

const jwtUser = (perms: string[]) => ({ sub: 'u1', sid: 's', perms }) as any;

describe('OAuthService state signing', () => {
  const { svc } = makeService();

  it('round-trips a signed state', () => {
    const payload = svc.verifyState(svc.signState({ userId: 'u1', provider: 'notion' }));
    expect(payload.userId).toBe('u1');
    expect(payload.provider).toBe('notion');
  });

  it('rejects a tampered state', () => {
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    expect(() => svc.verifyState(state.slice(0, -4) + 'AAAA')).toThrow();
  });

  it('rejects a forged signature with STATE_INVALID', () => {
    const [body] = svc.signState({ userId: 'u1', provider: 'notion' }).split('.');
    expect(() => svc.verifyState(`${body}.deadbeef`)).toThrow(expect.objectContaining({ code: 'STATE_INVALID' }));
  });

  it('rejects a state older than the 10-minute TTL with STATE_EXPIRED', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000_000_000);
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    now.mockReturnValue(1_000_000_000_000 + 11 * 60 * 1000);
    expect(() => svc.verifyState(state)).toThrow(expect.objectContaining({ code: 'STATE_EXPIRED' }));
    now.mockRestore();
  });
});

describe('OAuthService callback (never raw JSON in the popup)', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('maps a provider denial to ?error=ACCESS_DENIED&provider=', async () => {
    const { svc } = makeService();
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    const url = await svc.handleCallback('notion', undefined as unknown as string, state, 'access_denied');
    expect(url).toBe('http://localhost:3000/integrations?error=ACCESS_DENIED&provider=notion');
  });

  it('maps a missing code to MISSING_CODE', async () => {
    const { svc } = makeService();
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    expect(await svc.handleCallback('notion', undefined as unknown as string, state)).toContain(
      'error=MISSING_CODE',
    );
  });

  it('maps a garbage state to STATE_INVALID instead of throwing', async () => {
    const { svc } = makeService();
    expect(await svc.handleCallback('notion', 'code', 'garbage')).toBe(
      'http://localhost:3000/integrations?error=STATE_INVALID&provider=notion',
    );
  });

  it('maps a failed token exchange to EXCHANGE_FAILED without the provider body', async () => {
    const { svc, store } = makeService();
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":"invalid_grant","secret":"x"}' });
    const state = svc.signState({ userId: 'u1', provider: 'notion', scope: 'personal' });
    const url = await svc.handleCallback('notion', 'code', state);
    expect(url).toBe('http://localhost:3000/integrations?error=EXCHANGE_FAILED&provider=notion');
    expect(url).not.toContain('secret');
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it('re-checks the allow-list at the callback (admin blocked it mid-flow)', async () => {
    const { svc } = makeService({ connectorAllowList: ['gmail'] });
    const state = svc.signState({ userId: 'u1', provider: 'notion', scope: 'personal' });
    expect(await svc.handleCallback('notion', 'code', state)).toContain('error=CONNECTOR_NOT_ALLOWED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-checks the member at the callback (capability removed / blocked mid-flow)', async () => {
    const { svc } = makeService(undefined, []);
    const state = svc.signState({ userId: 'u1', provider: 'notion', scope: 'personal' });
    expect(await svc.handleCallback('notion', 'code', state)).toContain('error=INSUFFICIENT_PERMISSION');
  });

  it('persists a coherent catalog record and clears directory-only fields', async () => {
    const { svc, store } = makeService();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'at', workspace_name: 'WS' }) });
    const state = svc.signState({ userId: 'u1', provider: 'notion', scope: 'personal' });
    expect(await svc.handleCallback('notion', 'code', state)).toBe(
      'http://localhost:3000/integrations?connected=notion',
    );
    const write = store.upsert.mock.calls[0][0];
    expect(write).toMatchObject({ userId: 'u1', provider: 'notion', scope: 'personal' });
    expect(write.set.accountLabel).toBe('WS');
    expect(write.unset).toEqual(expect.arrayContaining(['tokenEndpoint', 'encryptedClientCreds', 'directorySlug']));
  });
});

describe('OAuthService buildAuthorizeUrl (Task P5-1)', () => {
  const { svc } = makeService();

  it('gmail URL includes scope + access_type + prompt and NO owner', () => {
    const url = svc.buildAuthorizeUrl(findCatalogEntry('gmail')!, 'st');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('scope=');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).not.toContain('owner=user');
  });

  it('notion URL still includes owner=user', () => {
    const url = svc.buildAuthorizeUrl(findCatalogEntry('notion')!, 'st');
    expect(url).toContain('owner=user');
    expect(url).not.toContain('access_type=offline');
  });
});

describe('OAuthService connect gating', () => {
  it('denies personal connect without CONNECT_PERSONAL_CONNECTOR', async () => {
    const { svc } = makeService();
    await expect(svc.startAuthorization('notion', jwtUser([]))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies when the provider is not in the workspace allow-list', async () => {
    const { svc } = makeService({ connectorAllowList: ['gmail'] });
    await expect(
      svc.startAuthorization('notion', jwtUser([Capability.CONNECT_PERSONAL_CONNECTOR])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('an empty allow-list allows every connector', async () => {
    const { svc } = makeService({ connectorAllowList: [] });
    const res = await svc.startAuthorization('gmail', jwtUser([Capability.CONNECT_PERSONAL_CONNECTOR]));
    expect(res.authorizeUrl).toContain('accounts.google.com');
  });

  it('allows personal connect with the cap AND an allow-listed provider', async () => {
    const { svc } = makeService({ connectorAllowList: ['notion'] });
    const res = await svc.startAuthorization('notion', jwtUser([Capability.CONNECT_PERSONAL_CONNECTOR]));
    expect(res.authorizeUrl).toContain('api.notion.com');
    expect(res.authorizeUrl).toContain('state=');
  });
});
