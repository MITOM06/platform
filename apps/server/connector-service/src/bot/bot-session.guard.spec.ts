import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Capability } from '@platform/database';
import { BotSessionGuard } from './bot-session.guard';

describe('BotSessionGuard', () => {
  let sessions: { validate: jest.Mock };
  let perms: { resolveMember: jest.Mock };
  let guard: BotSessionGuard;
  let req: any;

  const ctx = (headers: Record<string, unknown> | undefined): ExecutionContext => {
    req = { headers };
    return { switchToHttp: () => ({ getRequest: () => req }) } as any;
  };
  const member = (active: boolean, caps: string[]) => ({ exists: true, active, perms: new Set(caps) });

  beforeEach(() => {
    sessions = { validate: jest.fn().mockResolvedValue({ userId: 'u1', botUserId: 'b1' }) };
    perms = { resolveMember: jest.fn().mockResolvedValue(member(true, [Capability.USE_PERSONAL_ASSISTANT])) };
    guard = new BotSessionGuard(sessions as any, perms as any);
  });

  it('accepts a valid token of an active member with USE_PERSONAL_ASSISTANT and attaches the session', async () => {
    await expect(guard.canActivate(ctx({ authorization: 'Bearer tok-1' }))).resolves.toBe(true);
    expect(sessions.validate).toHaveBeenCalledWith('tok-1');
    expect(perms.resolveMember).toHaveBeenCalledWith('u1');
    expect(req.botSession).toEqual({ userId: 'u1', botUserId: 'b1' });
  });

  it.each([
    ['no headers', undefined],
    ['no authorization', {}],
    ['a non-Bearer scheme', { authorization: 'Basic dTpw' }],
    ['lower-case bearer', { authorization: 'bearer tok' }],
    ['an empty bearer', { authorization: 'Bearer ' }],
    ['an array header', { authorization: ['Bearer tok'] }],
  ])('401 BOT_TOKEN_MISSING for %s (no DB lookup)', async (_l, headers) => {
    const err = await guard.canActivate(ctx(headers as any)).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.getResponse()).toEqual({ code: 'BOT_TOKEN_MISSING' });
    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('401 BOT_TOKEN_INVALID for an unknown / revoked / expired token', async () => {
    sessions.validate.mockResolvedValue(null);
    const err = await guard.canActivate(ctx({ authorization: 'Bearer stale' })).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.getResponse()).toEqual({ code: 'BOT_TOKEN_INVALID' });
    expect(perms.resolveMember).not.toHaveBeenCalled();
    expect(req.botSession).toBeUndefined();
  });

  it('403 MEMBER_INACTIVE once the owning member is blocked (token still valid)', async () => {
    perms.resolveMember.mockResolvedValue(member(false, [Capability.USE_PERSONAL_ASSISTANT]));
    const err = await guard.canActivate(ctx({ authorization: 'Bearer tok' })).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toEqual({ code: 'MEMBER_INACTIVE' });
    expect(req.botSession).toBeUndefined();
  });

  it('403 INSUFFICIENT_PERMISSION once the role loses USE_PERSONAL_ASSISTANT', async () => {
    perms.resolveMember.mockResolvedValue(member(true, [Capability.RUN_SENSITIVE_SKILL]));
    const err = await guard.canActivate(ctx({ authorization: 'Bearer tok' })).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toEqual({
      code: 'INSUFFICIENT_PERMISSION',
      required: Capability.USE_PERSONAL_ASSISTANT,
    });
  });

  it('re-checks the member on EVERY request (no caching of standing)', async () => {
    const c = () => ctx({ authorization: 'Bearer tok' });
    await guard.canActivate(c());
    perms.resolveMember.mockResolvedValue(member(false, []));
    await expect(guard.canActivate(c())).rejects.toBeInstanceOf(ForbiddenException);
    expect(perms.resolveMember).toHaveBeenCalledTimes(2);
  });
});
