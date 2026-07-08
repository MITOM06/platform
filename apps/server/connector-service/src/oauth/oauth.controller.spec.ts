import { JwtAuthGuard } from '@platform/database';
import { OAuthController } from './oauth.controller';

/**
 * Task 2.2 — /oauth/:provider/start derives userId from the JWT; the
 * /callback stays PUBLIC (browser redirect, identity in the signed state).
 */
describe('OAuthController (JWT-derived identity)', () => {
  let controller: OAuthController;
  let oauth: any;
  let directoryConnect: any;

  beforeEach(() => {
    oauth = {
      startAuthorization: jest
        .fn()
        .mockResolvedValue({ authorizeUrl: 'https://x/authorize' }),
      handleCallback: jest.fn().mockResolvedValue('https://client?connected=notion'),
    };
    directoryConnect = {
      start: jest.fn().mockResolvedValue({ mode: 'oauth', authorizeUrl: 'https://d/authorize' }),
      connectWithKey: jest.fn().mockResolvedValue({ connected: true }),
      handleCallback: jest.fn().mockResolvedValue('https://client?connected=acme'),
    };
    controller = new OAuthController(oauth, directoryConnect);
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

  it('callback forwards a provider ?error to the service (deny flow)', async () => {
    oauth.handleCallback.mockResolvedValue('https://client?error=access_denied');
    const res = { redirect: jest.fn() } as any;
    await controller.callback(
      'notion',
      undefined as any,
      'the-state',
      'access_denied',
      res,
    );
    expect(oauth.handleCallback).toHaveBeenCalledWith(
      'notion',
      undefined,
      'the-state',
      'access_denied',
    );
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://client?error=access_denied');
  });

  it('startDirectory delegates to DirectoryConnectService with the JWT user', async () => {
    const user = { sub: 'jwt-user', perms: [] } as any;
    const res = await controller.startDirectory('acme', user);
    expect(directoryConnect.start).toHaveBeenCalledWith('acme', user);
    expect(res).toEqual({ mode: 'oauth', authorizeUrl: 'https://d/authorize' });
  });

  it('directory start is protected by JwtAuthGuard', () => {
    const guards = Reflect.getMetadata('__guards__', controller.startDirectory);
    expect(guards).toContain(JwtAuthGuard);
  });

  it('directory callback is NOT protected by JwtAuthGuard (public redirect)', () => {
    const guards =
      Reflect.getMetadata('__guards__', controller.directoryCallback) ?? [];
    expect(guards).not.toContain(JwtAuthGuard);
  });
});
