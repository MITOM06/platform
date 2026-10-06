// nanoid is ESM-only and Jest (CJS) cannot parse it — mock before import.
jest.mock('nanoid', () => ({ nanoid: () => 'test-sid' }));

import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { REDIS_CLIENT } from '@platform/database';
import { SessionService, SESSIONS_REVOKED_CHANNEL } from './session.service';
import { AuthCode } from '../../common/auth-code.enum';

/**
 * rotateRefreshToken — reuse-detection classification.
 *
 * The security-sensitive branches:
 *  - previous token WITHIN the grace window  → REFRESH_TOKEN_ROTATED (benign
 *    staggered multi-tab race — MUST NOT revoke the session)
 *  - previous token OUTSIDE the grace window → REFRESH_TOKEN_REUSE (theft —
 *    revoke)
 *  - unknown token                            → REFRESH_TOKEN_INVALID
 */
describe('SessionService.rotateRefreshToken', () => {
  let service: SessionService;
  let redis: {
    hgetall: jest.Mock;
    eval: jest.Mock;
    multi: jest.Mock;
    pipeline: jest.Mock;
    smembers: jest.Mock;
  };

  const CURRENT_TOKEN = 'v3.current-token';
  const PREV_TOKEN = 'v2.previous-token';

  let currentHash: string;
  let prevHash: string;

  beforeAll(async () => {
    currentHash = await argon2.hash(CURRENT_TOKEN);
    prevHash = await argon2.hash(PREV_TOKEN);
  });

  function sessionData(overrides: Record<string, string> = {}) {
    return {
      userId: 'u1',
      refreshHash: currentHash,
      prevRefreshHash: prevHash,
      tokenVersion: '3',
      revoked: '0',
      createdAt: '1',
      lastSeenAt: Date.now().toString(),
      rotatedAt: Date.now().toString(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    const multiChain = {
      hset: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redis = {
      hgetall: jest.fn(),
      eval: jest.fn().mockResolvedValue(1),
      multi: jest.fn().mockReturnValue(multiChain),
      pipeline: jest.fn().mockReturnValue(multiChain),
      smembers: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = moduleRef.get(SessionService);
  });

  async function rotateExpectingCode(refreshToken: string): Promise<string> {
    try {
      await service.rotateRefreshToken({ sid: 's1', refreshToken });
      throw new Error('expected rotateRefreshToken to throw');
    } catch (e) {
      if (!(e instanceof UnauthorizedException)) throw e;
      return (e.getResponse() as { code: string }).code;
    }
  }

  it('rotates normally when the current token is presented', async () => {
    redis.hgetall.mockResolvedValue(sessionData());

    const result = await service.rotateRefreshToken({
      sid: 's1',
      refreshToken: CURRENT_TOKEN,
    });

    expect(result.userId).toBe('u1');
    expect(result.newRefreshToken).toMatch(/^v4\./);
    expect(redis.eval).toHaveBeenCalled();
    expect(result.claimsAt).toBeUndefined();
  });

  it('a claims-stale session still rotates and reports its claimsAt', async () => {
    redis.hgetall.mockResolvedValue(sessionData({ claimsAt: '1700000005' }));

    const result = await service.rotateRefreshToken({
      sid: 's1',
      refreshToken: CURRENT_TOKEN,
    });

    expect(result.newRefreshToken).toMatch(/^v4\./);
    expect(result.claimsAt).toBe(1_700_000_005);
  });

  it('treats the previous token WITHIN the grace window as a benign race (no revoke)', async () => {
    // Rotated 1 second ago — a staggered sibling-tab refresh, not theft.
    redis.hgetall.mockResolvedValue(
      sessionData({ rotatedAt: (Date.now() - 1_000).toString() }),
    );

    const code = await rotateExpectingCode(PREV_TOKEN);

    expect(code).toBe(AuthCode.REFRESH_TOKEN_ROTATED);
    // No revocation was written.
    expect(redis.multi).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('treats the previous token OUTSIDE the grace window as reuse and revokes', async () => {
    // Rotated 10 minutes ago — replaying the superseded token now is theft.
    redis.hgetall.mockResolvedValue(
      sessionData({ rotatedAt: (Date.now() - 600_000).toString() }),
    );

    const code = await rotateExpectingCode(PREV_TOKEN);

    expect(code).toBe(AuthCode.REFRESH_TOKEN_REUSE);
    // revokeSession writes through a multi().
    expect(redis.multi).toHaveBeenCalled();
  });

  it('rejects an unknown token as invalid without revoking', async () => {
    redis.hgetall.mockResolvedValue(sessionData());

    const code = await rotateExpectingCode('v3.some-forged-token');

    expect(code).toBe(AuthCode.REFRESH_TOKEN_INVALID);
    expect(redis.multi).not.toHaveBeenCalled();
  });

  it('a forged OLDER-version token (v0.x) is just invalid — it must not revoke the session', async () => {
    // The v<n> prefix is caller-supplied; anyone who knows a sid could otherwise
    // log its owner out by sending "v0.anything".
    redis.hgetall.mockResolvedValue(
      sessionData({ rotatedAt: (Date.now() - 600_000).toString() }),
    );

    const code = await rotateExpectingCode('v0.forged-older-version');

    expect(code).toBe(AuthCode.REFRESH_TOKEN_INVALID);
    expect(redis.multi).not.toHaveBeenCalled();
    expect(redis.pipeline).not.toHaveBeenCalled();
  });

  it('rejects a revoked session', async () => {
    redis.hgetall.mockResolvedValue(sessionData({ revoked: '1' }));

    const code = await rotateExpectingCode(CURRENT_TOKEN);

    expect(code).toBe(AuthCode.SESSION_REVOKED);
  });

  it('reports the benign CAS race when the atomic rotation loses', async () => {
    redis.hgetall.mockResolvedValue(sessionData());
    redis.eval.mockResolvedValue(0);

    const code = await rotateExpectingCode(CURRENT_TOKEN);

    expect(code).toBe(AuthCode.REFRESH_TOKEN_ROTATED);
    expect(redis.multi).not.toHaveBeenCalled();
  });
});

/**
 * revokeAllSessions — marks every sid revoked AND publishes
 * `auth:sessions-revoked` so other services drop live connections instantly.
 */
describe('SessionService.revokeAllSessions / refresh-owner helpers', () => {
  let service: SessionService;
  let pipe: { hset: jest.Mock; srem: jest.Mock; exec: jest.Mock };
  let redis: {
    smembers: jest.Mock;
    pipeline: jest.Mock;
    publish: jest.Mock;
    hget: jest.Mock;
    hmget: jest.Mock;
  };

  beforeEach(async () => {
    pipe = {
      hset: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redis = {
      smembers: jest.fn().mockResolvedValue(['a', 'b']),
      pipeline: jest.fn().mockReturnValue(pipe),
      publish: jest.fn().mockResolvedValue(1),
      hget: jest.fn(),
      hmget: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [SessionService, { provide: REDIS_CLIENT, useValue: redis }],
    }).compile();
    service = moduleRef.get(SessionService);
  });

  it('revokes every sid then publishes {userId, reason} on auth:sessions-revoked', async () => {
    await service.revokeAllSessions('u1', 'blocked');

    expect(pipe.hset).toHaveBeenCalledWith('sess:a', { revoked: '1' });
    expect(pipe.hset).toHaveBeenCalledWith('sess:b', { revoked: '1' });
    expect(pipe.exec).toHaveBeenCalled();
    expect(SESSIONS_REVOKED_CHANNEL).toBe('auth:sessions-revoked');
    expect(redis.publish).toHaveBeenCalledWith(
      'auth:sessions-revoked',
      JSON.stringify({ userId: 'u1', reason: 'blocked' }),
    );
    // Publish happens after the revoke is persisted.
    expect(redis.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      pipe.exec.mock.invocationCallOrder[0],
    );
  });

  it('defaults reason to "other" and still publishes when no sid is tracked', async () => {
    redis.smembers.mockResolvedValue([]);
    await service.revokeAllSessions('u2');
    expect(redis.pipeline).not.toHaveBeenCalled();
    expect(redis.publish).toHaveBeenCalledWith(
      'auth:sessions-revoked',
      JSON.stringify({ userId: 'u2', reason: 'other' }),
    );
  });

  it('a failed publish never throws out of the revoke', async () => {
    redis.publish.mockRejectedValue(new Error('redis down'));
    await expect(service.revokeAllSessions('u1', 'role_changed')).resolves.toBeUndefined();
    expect(pipe.exec).toHaveBeenCalled();
  });

  it('peekSessionUserId reads userId even from a revoked session', async () => {
    redis.hget.mockResolvedValue('u1');
    await expect(service.peekSessionUserId('s1')).resolves.toBe('u1');
    expect(redis.hget).toHaveBeenCalledWith('sess:s1', 'userId');
    redis.hget.mockResolvedValue(null);
    await expect(service.peekSessionUserId('gone')).resolves.toBeNull();
  });

  it('revokeSession only revokes a session the user owns (logout cannot hit others)', async () => {
    const multi = {
      hset: jest.fn().mockReturnThis(),
      srem: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    (redis as any).multi = jest.fn().mockReturnValue(multi);
    (redis as any).srem = jest.fn().mockResolvedValue(1);

    // carol's session presented by eve → refused, nothing written.
    redis.hget.mockResolvedValue('carol');
    await expect(service.revokeSession('eve', 's-carol')).resolves.toBe(false);
    expect((redis as any).multi).not.toHaveBeenCalled();

    // Own session → revoked.
    redis.hget.mockResolvedValue('eve');
    await expect(service.revokeSession('eve', 's-eve')).resolves.toBe(true);
    expect(multi.hset).toHaveBeenCalledWith('sess:s-eve', { revoked: '1' });
    expect(multi.srem).toHaveBeenCalledWith('user:eve:sessions', 's-eve');

    // Missing sid → no `sess:undefined` written; expired hash → only the own set is cleaned.
    (redis as any).multi.mockClear();
    redis.hget.mockClear();
    await expect(service.revokeSession('eve', undefined as any)).resolves.toBe(false);
    await expect(service.revokeSession('eve', '')).resolves.toBe(false);
    expect(redis.hget).not.toHaveBeenCalled();
    redis.hget.mockResolvedValue(null);
    await expect(service.revokeSession('eve', 's-gone')).resolves.toBe(false);
    expect((redis as any).srem).toHaveBeenCalledWith('user:eve:sessions', 's-gone');
    expect((redis as any).multi).not.toHaveBeenCalled();
  });

  it('revokeOtherSessions keeps the caller session and does not broadcast a user-wide revoke', async () => {
    redis.smembers.mockResolvedValue(['keep', 'a', 'b']);
    await expect(service.revokeOtherSessions('u1', 'keep')).resolves.toBe(2);
    expect(pipe.hset).toHaveBeenCalledWith('sess:a', { revoked: '1' });
    expect(pipe.hset).toHaveBeenCalledWith('sess:b', { revoked: '1' });
    expect(pipe.hset).not.toHaveBeenCalledWith('sess:keep', expect.anything());
    // auth:sessions-revoked closes EVERY socket of the user (incl. the caller's).
    expect(redis.publish).not.toHaveBeenCalled();

    redis.smembers.mockResolvedValue(['keep']);
    pipe.exec.mockClear();
    await expect(service.revokeOtherSessions('u1', 'keep')).resolves.toBe(0);
    expect(pipe.exec).not.toHaveBeenCalled();
  });

  it('refreshTokenBelongsToSession matches current or previous hash only', async () => {
    const cur = await argon2.hash('v1.cur');
    const prev = await argon2.hash('v0.prev');
    redis.hmget.mockResolvedValue([cur, prev]);
    await expect(service.refreshTokenBelongsToSession('s1', 'v1.cur')).resolves.toBe(true);
    await expect(service.refreshTokenBelongsToSession('s1', 'v0.prev')).resolves.toBe(true);
    await expect(service.refreshTokenBelongsToSession('s1', 'v1.forged')).resolves.toBe(false);
    redis.hmget.mockResolvedValue([null, null]);
    await expect(service.refreshTokenBelongsToSession('s1', 'v1.cur')).resolves.toBe(false);
  }, 30_000); // argon2 is slow under a fully parallel jest run
});
