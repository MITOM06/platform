// nanoid is ESM-only and Jest (CJS) cannot parse it — mock before import.
jest.mock('nanoid', () => ({ nanoid: () => 'test-sid' }));

import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { SessionService } from './session.service';
import { AuthCode } from '../../common/auth-code.enum';

/**
 * rotateRefreshToken edge cases not covered by session.service.spec.ts:
 * missing session, no previous hash, never-rotated session, the
 * REFRESH_REUSE_REVOKE_ALL / REFRESH_REUSE_GRACE_MS env switches;
 * plus listSessions filtering of expired / errored rows.
 */
const CURRENT = 'v3.current-token';
const PREV = 'v2.previous-token';
let currentHash: string;
let prevHash: string;

beforeAll(async () => {
  currentHash = await argon2.hash(CURRENT);
  prevHash = await argon2.hash(PREV);
});

function makeRedis() {
  const multiChain = {
    hset: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  const pipe = {
    hset: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    hgetall: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  const redis = {
    hgetall: jest.fn(),
    eval: jest.fn().mockResolvedValue(1),
    multi: jest.fn().mockReturnValue(multiChain),
    pipeline: jest.fn().mockReturnValue(pipe),
    smembers: jest.fn().mockResolvedValue([]),
    publish: jest.fn().mockResolvedValue(1),
  };
  return { redis, multiChain, pipe };
}

function session(overrides: Record<string, string> = {}) {
  return {
    userId: 'u1',
    refreshHash: currentHash,
    prevRefreshHash: prevHash,
    tokenVersion: '3',
    revoked: '0',
    rotatedAt: (Date.now() - 600_000).toString(),
    ...overrides,
  };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof UnauthorizedException) {
      return (e.getResponse() as { code: string }).code;
    }
    throw e;
  }
  throw new Error('expected an UnauthorizedException');
}

describe('SessionService.rotateRefreshToken — edge cases', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it.each([[{}], [null], [{ refreshHash: 'x' }]])(
    'unknown / expired session (%p) → SESSION_INVALID, nothing written',
    async (data) => {
      const { redis } = makeRedis();
      redis.hgetall.mockResolvedValue(data);
      const svc = new SessionService(redis as never);

      await expect(
        codeOf(svc.rotateRefreshToken({ sid: 'gone', refreshToken: CURRENT })),
      ).resolves.toBe(AuthCode.SESSION_INVALID);
      expect(redis.hgetall).toHaveBeenCalledWith('sess:gone');
      expect(redis.eval).not.toHaveBeenCalled();
      expect(redis.multi).not.toHaveBeenCalled();
    },
  );

  it('revoked session rejects even the CURRENT token before any hash check', async () => {
    const { redis } = makeRedis();
    redis.hgetall.mockResolvedValue(session({ revoked: '1' }));
    const svc = new SessionService(redis as never);

    await expect(
      codeOf(svc.rotateRefreshToken({ sid: 's1', refreshToken: CURRENT })),
    ).resolves.toBe(AuthCode.SESSION_REVOKED);
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('first rotation (no prevRefreshHash yet) → a non-current token is INVALID, never revokes', async () => {
    const { redis } = makeRedis();
    const data: Record<string, string> = session();
    delete data.prevRefreshHash;
    redis.hgetall.mockResolvedValue(data);
    const svc = new SessionService(redis as never);

    await expect(
      codeOf(svc.rotateRefreshToken({ sid: 's1', refreshToken: PREV })),
    ).resolves.toBe(AuthCode.REFRESH_TOKEN_INVALID);
    expect(redis.multi).not.toHaveBeenCalled();
    expect(redis.pipeline).not.toHaveBeenCalled();
  });

  it('rotatedAt "0" (never rotated) is not inside the grace window → prev token is REUSE + revokes this session only', async () => {
    const { redis, multiChain } = makeRedis();
    redis.hgetall.mockResolvedValue(session({ rotatedAt: '0' }));
    const svc = new SessionService(redis as never);

    await expect(
      codeOf(svc.rotateRefreshToken({ sid: 's1', refreshToken: PREV })),
    ).resolves.toBe(AuthCode.REFRESH_TOKEN_REUSE);
    expect(multiChain.hset).toHaveBeenCalledWith('sess:s1', { revoked: '1' });
    expect(multiChain.srem).toHaveBeenCalledWith('user:u1:sessions', 's1');
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('REFRESH_REUSE_REVOKE_ALL=true → reuse revokes EVERY session of the owner and broadcasts refresh_reuse', async () => {
    process.env.REFRESH_REUSE_REVOKE_ALL = 'true';
    const { redis, pipe, multiChain } = makeRedis();
    redis.hgetall.mockResolvedValue(session());
    redis.smembers.mockResolvedValue(['s1', 's2']);
    const svc = new SessionService(redis as never);

    await expect(
      codeOf(svc.rotateRefreshToken({ sid: 's1', refreshToken: PREV })),
    ).resolves.toBe(AuthCode.REFRESH_TOKEN_REUSE);
    expect(redis.smembers).toHaveBeenCalledWith('user:u1:sessions');
    expect(pipe.hset).toHaveBeenCalledWith('sess:s1', { revoked: '1' });
    expect(pipe.hset).toHaveBeenCalledWith('sess:s2', { revoked: '1' });
    expect(redis.publish).toHaveBeenCalledWith(
      'auth:sessions-revoked',
      JSON.stringify({ userId: 'u1', reason: 'refresh_reuse' }),
    );
    expect(multiChain.hset).not.toHaveBeenCalled();
  });

  it('REFRESH_REUSE_REVOKE_ALL other than "true" keeps the single-session revoke', async () => {
    process.env.REFRESH_REUSE_REVOKE_ALL = '1';
    const { redis, multiChain } = makeRedis();
    redis.hgetall.mockResolvedValue(session());
    const svc = new SessionService(redis as never);

    await codeOf(svc.rotateRefreshToken({ sid: 's1', refreshToken: PREV }));
    expect(multiChain.hset).toHaveBeenCalledWith('sess:s1', { revoked: '1' });
    expect(redis.publish).not.toHaveBeenCalled();
  });

  it('REFRESH_REUSE_GRACE_MS=0 disables the grace window: prev token 1s after rotation is REUSE', async () => {
    process.env.REFRESH_REUSE_GRACE_MS = '0';
    const { redis, multiChain } = makeRedis();
    redis.hgetall.mockResolvedValue(
      session({ rotatedAt: (Date.now() - 1_000).toString() }),
    );
    const svc = new SessionService(redis as never);

    await expect(
      codeOf(svc.rotateRefreshToken({ sid: 's1', refreshToken: PREV })),
    ).resolves.toBe(AuthCode.REFRESH_TOKEN_REUSE);
    expect(multiChain.hset).toHaveBeenCalledWith('sess:s1', { revoked: '1' });
  });

  it('CAS is called with the expected version, version+1 and the configured TTL; new token verifies against the stored hash', async () => {
    process.env.REFRESH_TOKEN_TTL_SECONDS = '120';
    const { redis } = makeRedis();
    redis.hgetall.mockResolvedValue(session({ tokenVersion: '7' }));
    const svc = new SessionService(redis as never);

    const out = await svc.rotateRefreshToken({ sid: 's1', refreshToken: CURRENT });

    expect(out.userId).toBe('u1');
    expect(out.newRefreshToken).toMatch(/^v8\./);
    const args = redis.eval.mock.calls[0];
    expect(args.slice(1, 5)).toEqual([1, 'sess:s1', '7', '8']);
    expect(args[7]).toBe('120');
    await expect(argon2.verify(args[5], out.newRefreshToken)).resolves.toBe(true);
  });

  it('missing tokenVersion defaults to 0 → rotates to v1', async () => {
    const { redis } = makeRedis();
    const data: Record<string, string> = session();
    delete data.tokenVersion;
    redis.hgetall.mockResolvedValue(data);
    const svc = new SessionService(redis as never);

    const out = await svc.rotateRefreshToken({ sid: 's1', refreshToken: CURRENT });
    expect(out.newRefreshToken).toMatch(/^v1\./);
    expect(redis.eval.mock.calls[0].slice(3, 5)).toEqual(['0', '1']);
  });
});

describe('SessionService.listSessions', () => {
  it('no tracked sid → [] without opening a pipeline', async () => {
    const { redis } = makeRedis();
    redis.smembers.mockResolvedValue([]);
    const svc = new SessionService(redis as never);
    await expect(svc.listSessions('u1')).resolves.toEqual([]);
    expect(redis.smembers).toHaveBeenCalledWith('user:u1:sessions');
    expect(redis.pipeline).not.toHaveBeenCalled();
  });

  it('null smembers reply → []', async () => {
    const { redis } = makeRedis();
    redis.smembers.mockResolvedValue(null);
    const svc = new SessionService(redis as never);
    await expect(svc.listSessions('u1')).resolves.toEqual([]);
  });

  it('returns only live hashes, keyed by sid; drops expired (empty), errored and missing rows', async () => {
    const { redis, pipe } = makeRedis();
    redis.smembers.mockResolvedValue(['a', 'b', 'c', 'd']);
    pipe.exec.mockResolvedValue([
      [null, { userId: 'u1', platform: 'web' }],
      [null, {}], // hash expired → hgetall returns {}
      [new Error('WRONGTYPE'), null],
      // 'd' has no result row at all
    ]);
    const svc = new SessionService(redis as never);

    await expect(svc.listSessions('u1')).resolves.toEqual([
      { sid: 'a', userId: 'u1', platform: 'web' },
    ]);
    expect(pipe.hgetall).toHaveBeenCalledWith('sess:a');
    expect(pipe.hgetall).toHaveBeenCalledWith('sess:d');
  });

  it('pipeline exec returning null → []', async () => {
    const { redis, pipe } = makeRedis();
    redis.smembers.mockResolvedValue(['a']);
    pipe.exec.mockResolvedValue(null);
    const svc = new SessionService(redis as never);
    await expect(svc.listSessions('u1')).resolves.toEqual([]);
  });
});
