import { ExecutionContext } from '@nestjs/common';
import { GoogleOAuthGuard } from './google-oauth.guard';

const ctx = (query: Record<string, string>, cookies: Record<string, string> = {}) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ query, cookies }) }),
  }) as unknown as ExecutionContext;

describe('GoogleOAuthGuard', () => {
  const guard = new GoogleOAuthGuard();

  it('always asks Google to show the account chooser', () => {
    expect(guard.getAuthenticateOptions(ctx({ platform: 'web' }))).toMatchObject({
      prompt: 'select_account',
    });
  });

  it('carries the platform in state', () => {
    expect(guard.getAuthenticateOptions(ctx({ platform: 'web' })).state).toBe('web');
    expect(guard.getAuthenticateOptions(ctx({})).state).toBe('mobile');
  });

  it('appends a valid invite flow id and drops a malformed one', () => {
    const flow = 'abcdEFGH1234_-xyz';
    expect(guard.getAuthenticateOptions(ctx({ platform: 'web', flow })).state).toBe(`web.${flow}`);
    expect(guard.getAuthenticateOptions(ctx({ platform: 'web', flow: 'bad id!' })).state).toBe('web');
  });
});
