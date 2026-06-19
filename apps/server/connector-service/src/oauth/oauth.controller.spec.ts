import { JwtAuthGuard } from '@platform/database';
import { OAuthController } from './oauth.controller';

/**
 * Task 2.2 — /oauth/:provider/start derives userId from the JWT; the
 * /callback stays PUBLIC (browser redirect, identity in the signed state).
 */
describe('OAuthController (JWT-derived identity)', () => {
  let controller: OAuthController;
  let oauth: any;

  beforeEach(() => {
    oauth = {
      startAuthorization: jest
        .fn()
        .mockResolvedValue({ authorizeUrl: 'https://x/authorize' }),
      handleCallback: jest.fn().mockResolvedValue('https://client?connected=notion'),
    };
    controller = new OAuthController(oauth);
  });

  it('start is protected by JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', controller.start);
    expect(guards).toContain(JwtAuthGuard);
  });

  it('start passes the JWT user (identity from token) to the service', async () => {
    const user = { sub: 'jwt-user', sid: 's', perms: [] } as any;
    await controller.start('notion', user);
    expect(oauth.startAuthorization).toHaveBeenCalledWith('notion', user);
  });

  it('callback is NOT protected by JwtAuthGuard (public redirect)', () => {
    const guards =
      Reflect.getMetadata('__guards__', controller.callback) ?? [];
    expect(guards).not.toContain(JwtAuthGuard);
  });
});
