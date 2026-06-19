import { ForbiddenException } from '@nestjs/common';
import { Capability } from '@platform/database';
import { OAuthService } from './oauth.service';

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
  return new OAuthService(cfg, {} as any, {} as any, wsModel as any);
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
