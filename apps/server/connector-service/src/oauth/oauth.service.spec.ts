import { OAuthService } from './oauth.service';

function makeService(): OAuthService {
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
  // vault + model not needed for state tests
  return new OAuthService(cfg, {} as any, {} as any);
}

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
