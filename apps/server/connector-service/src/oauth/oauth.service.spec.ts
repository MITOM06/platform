import { ForbiddenException } from '@nestjs/common';
import { Capability } from '@platform/database';
import { OAuthService } from './oauth.service';
import { findCatalogEntry } from '../catalog/catalog';

function makeService(workspace?: any): OAuthService {
  const cfg = {
    get: (k: string) => {
      const map: Record<string, any> = {
        internalApiKey: 'internal-secret',
        oauthRedirectBase: 'http://localhost:3003',
        clientRedirectUrl: 'http://localhost:3000/integrations',
      };
      return map[k];
    },
  } as any;
  const wsModel = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(
        workspace === undefined
          ? { connectorAllowList: ['notion'] }
          : workspace,
      ),
    }),
  };
  // vault + connModel not needed for state/gating tests
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return new OAuthService(cfg, {} as any, {} as any, wsModel as any, audit as any);
}

const jwtUser = (perms: string[]) =>
  ({ sub: 'u1', sid: 's', perms }) as any;

describe('OAuthService state signing', () => {
  const svc = makeService();

  it('round-trips a signed state', () => {
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    const payload = svc.verifyState(state);
    expect(payload.userId).toBe('u1');
    expect(payload.provider).toBe('notion');
  });

  it('rejects a tampered state', () => {
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    const tampered = state.slice(0, -4) + 'AAAA';
    expect(() => svc.verifyState(tampered)).toThrow();
  });

  it('rejects a forged signature', () => {
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    const [body] = state.split('.');
    expect(() => svc.verifyState(`${body}.deadbeef`)).toThrow();
  });

  it('accepts a fresh state within the TTL', () => {
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    expect(svc.verifyState(state).userId).toBe('u1');
  });

  it('rejects a state older than the 10-minute TTL', () => {
    const now = jest.spyOn(Date, 'now');
    // Sign 11 minutes in the past, then verify at real "now".
    now.mockReturnValue(1_000_000_000_000);
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    now.mockReturnValue(1_000_000_000_000 + 11 * 60 * 1000);
    expect(() => svc.verifyState(state)).toThrow(/expired/i);
    now.mockRestore();
  });
});

describe('OAuthService callback deny handling (no raw JSON to browser)', () => {
  it('bounces to the client with ?error on provider deny (does not throw)', async () => {
    const svc = makeService();
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    const url = await svc.handleCallback(
      'notion',
      undefined as unknown as string,
      state,
      'access_denied',
    );
    expect(url).toBe('http://localhost:3000/integrations?error=access_denied');
  });

  it('bounces with ?error=missing_code when code is absent and no error param', async () => {
    const svc = makeService();
    const state = svc.signState({ userId: 'u1', provider: 'notion' });
    const url = await svc.handleCallback(
      'notion',
      undefined as unknown as string,
      state,
    );
    expect(url).toContain('error=missing_code');
  });
});

describe('OAuthService buildAuthorizeUrl (Task P5-1)', () => {
  const svc = makeService();

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

describe('OAuthService personal connect gating (Task 2.3)', () => {
  it('denies personal connect without CONNECT_PERSONAL_CONNECTOR', async () => {
    const svc = makeService();
    await expect(
      svc.startAuthorization('notion', jwtUser([])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies when the provider is not in the workspace allow-list', async () => {
    const svc = makeService({ connectorAllowList: ['gmail'] });
    await expect(
      svc.startAuthorization(
        'notion',
        jwtUser([Capability.CONNECT_PERSONAL_CONNECTOR]),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows personal connect with the cap AND an allow-listed provider', async () => {
    const svc = makeService({ connectorAllowList: ['notion'] });
    const res = await svc.startAuthorization(
      'notion',
      jwtUser([Capability.CONNECT_PERSONAL_CONNECTOR]),
    );
    expect(res.authorizeUrl).toContain('api.notion.com');
    expect(res.authorizeUrl).toContain('state=');
  });
});
