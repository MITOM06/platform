import { ExecutionContext } from '@nestjs/common';
import {
  GoogleOAuthGuard,
  parseGoogleCallbackState,
} from './google-oauth.guard';

const ctx = (
  query: Record<string, string>,
  cookies: Record<string, string> = {},
) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ query, cookies }) }),
  }) as unknown as ExecutionContext;

describe('GoogleOAuthGuard', () => {
  const guard = new GoogleOAuthGuard();

  it('always asks Google to show the account chooser', () => {
    expect(
      guard.getAuthenticateOptions(ctx({ platform: 'web' })),
    ).toMatchObject({
      prompt: 'select_account',
    });
  });

  it('carries the platform in state', () => {
    expect(guard.getAuthenticateOptions(ctx({ platform: 'web' })).state).toBe(
      'web',
    );
    expect(guard.getAuthenticateOptions(ctx({})).state).toBe('mobile');
  });

  it('appends a valid invite flow id and drops a malformed one', () => {
    const flow = 'abcdEFGH1234_-xyz';
    expect(
      guard.getAuthenticateOptions(ctx({ platform: 'web', flow })).state,
    ).toBe(`web.${flow}`);
    expect(
      guard.getAuthenticateOptions(ctx({ platform: 'web', flow: 'bad id!' }))
        .state,
    ).toBe('web');
  });

  describe('handleRequest (callback without a user)', () => {
    it('passes a signed-in Google profile through', () => {
      const user = { id: 'g1' };
      expect(guard.handleRequest(null, user, undefined, ctx({}))).toBe(user);
    });

    it('cancelled on Google (?error=access_denied) → 401 SOCIAL_LOGIN_CANCELLED', () => {
      expect(() =>
        guard.handleRequest(
          null,
          false,
          undefined,
          ctx({ error: 'access_denied' }),
        ),
      ).toThrow(
        expect.objectContaining({
          response: { code: 'SOCIAL_LOGIN_CANCELLED' },
        }),
      );
    });

    it('refused code (TokenError) → 401 SOCIAL_LOGIN_FAILED', () => {
      expect(() =>
        guard.handleRequest(
          new Error('Malformed auth code.'),
          false,
          undefined,
          ctx({ code: 'x' }),
        ),
      ).toThrow(
        expect.objectContaining({ response: { code: 'SOCIAL_LOGIN_FAILED' } }),
      );
    });
  });
});

describe('parseGoogleCallbackState', () => {
  it('reads "<platform>" and "<platform>.<flowId>", falling back to the cookie', () => {
    expect(parseGoogleCallbackState({ query: { state: 'web' } })).toEqual({
      platform: 'web',
      flowId: undefined,
    });
    expect(parseGoogleCallbackState({ query: { state: 'web.f1' } })).toEqual({
      platform: 'web',
      flowId: 'f1',
    });
    expect(
      parseGoogleCallbackState({
        query: {},
        cookies: { oauth_platform: 'web' },
      }),
    ).toEqual({
      platform: 'web',
      flowId: undefined,
    });
    expect(parseGoogleCallbackState({})).toEqual({
      platform: 'mobile',
      flowId: undefined,
    });
  });
});
