import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SharedJwtStrategy } from './jwt.guard';

/**
 * SharedJwtStrategy (ai-service + connector-service) must enforce the same
 * `sess:{sid}` check as auth-service: exists, userId === sub, revoked !== '1'.
 */
describe('SharedJwtStrategy — session check', () => {
  const OLD_SECRET = process.env.JWT_ACCESS_SECRET;
  let redis: { hmget: jest.Mock };
  let strategy: SharedJwtStrategy;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
  });
  afterAll(() => {
    process.env.JWT_ACCESS_SECRET = OLD_SECRET;
  });

  beforeEach(() => {
    redis = { hmget: jest.fn() };
    strategy = new SharedJwtStrategy(redis as any);
  });

  async function codeOf(p: Promise<unknown>): Promise<{ status: number; code: string }> {
    try {
      await p;
    } catch (e: any) {
      return { status: e.getStatus(), code: e.getResponse().code };
    }
    throw new Error('expected rejection');
  }

  const payload = {
    sub: 'u1',
    sid: 's1',
    role: 'Member',
    perms: ['x'],
    depts: [],
    iat: 1_700_000_000,
  };

  it('active session → returns the JwtUser', async () => {
    redis.hmget.mockResolvedValue(['u1', '0']);
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      sub: 'u1',
      sid: 's1',
      role: 'Member',
      perms: ['x'],
    });
    expect(redis.hmget).toHaveBeenCalledWith(
      'sess:s1',
      'userId',
      'revoked',
      'claimsAt',
    );
  });

  it('revoked session → 401 SESSION_REVOKED', async () => {
    redis.hmget.mockResolvedValue(['u1', '1']);
    await expect(codeOf(strategy.validate(payload))).resolves.toEqual({
      status: 401,
      code: 'SESSION_REVOKED',
    });
  });

  it('missing session → 401 SESSION_NOT_FOUND', async () => {
    redis.hmget.mockResolvedValue([null, null]);
    await expect(codeOf(strategy.validate(payload))).resolves.toEqual({
      status: 401,
      code: 'SESSION_NOT_FOUND',
    });
  });

  it('session of another user → 401 TOKEN_SESSION_MISMATCH', async () => {
    redis.hmget.mockResolvedValue(['someone-else', '0']);
    await expect(codeOf(strategy.validate(payload))).resolves.toEqual({
      status: 401,
      code: 'TOKEN_SESSION_MISMATCH',
    });
  });

  it('token without sub/sid → 401 TOKEN_INVALID, no Redis call', async () => {
    await expect(
      strategy.validate({ sub: 'u1' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.hmget).not.toHaveBeenCalled();
  });

  describe('claimsAt (role / department / permission change)', () => {
    it('token minted BEFORE claimsAt → 401 TOKEN_CLAIMS_STALE', async () => {
      redis.hmget.mockResolvedValue(['u1', '0', String(payload.iat + 1)]);
      await expect(codeOf(strategy.validate(payload))).resolves.toEqual({
        status: 401,
        code: 'TOKEN_CLAIMS_STALE',
      });
    });

    it('token minted in the same second as claimsAt (strict <) → accepted', async () => {
      redis.hmget.mockResolvedValue(['u1', '0', String(payload.iat)]);
      await expect(strategy.validate(payload)).resolves.toMatchObject({ sub: 'u1' });
    });

    it('token minted AFTER claimsAt → accepted', async () => {
      redis.hmget.mockResolvedValue(['u1', '0', String(payload.iat - 30)]);
      await expect(strategy.validate(payload)).resolves.toMatchObject({ sub: 'u1' });
    });

    it('no claimsAt on the session → no check (legacy sessions)', async () => {
      redis.hmget.mockResolvedValue(['u1', '0', null]);
      await expect(
        strategy.validate({ ...payload, iat: undefined }),
      ).resolves.toMatchObject({ sub: 'u1' });
    });

    it('claimsAt set but the token has no iat → stale (cannot prove freshness)', async () => {
      redis.hmget.mockResolvedValue(['u1', '0', '1']);
      await expect(
        codeOf(strategy.validate({ ...payload, iat: undefined })),
      ).resolves.toEqual({ status: 401, code: 'TOKEN_CLAIMS_STALE' });
    });

    it('revoked / mismatched sessions keep their own codes (checked first)', async () => {
      redis.hmget.mockResolvedValue(['u1', '1', String(payload.iat + 1)]);
      await expect(codeOf(strategy.validate(payload))).resolves.toMatchObject({
        code: 'SESSION_REVOKED',
      });
      redis.hmget.mockResolvedValue(['u2', '0', String(payload.iat + 1)]);
      await expect(codeOf(strategy.validate(payload))).resolves.toMatchObject({
        code: 'TOKEN_SESSION_MISMATCH',
      });
    });
  });

  it('Redis failure → fails closed with 503 SESSION_CHECK_UNAVAILABLE', async () => {
    redis.hmget.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(codeOf(strategy.validate(payload))).resolves.toEqual({
      status: 503,
      code: 'SESSION_CHECK_UNAVAILABLE',
    });
  });
});
