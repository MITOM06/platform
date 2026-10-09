// nanoid is ESM-only and Jest (CJS) cannot parse it — mock before import.
jest.mock('nanoid', () => ({ nanoid: () => 'test-sid' }));

import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { REDIS_CLIENT } from '@platform/database';
import { SessionService, SESSIONS_REVOKED_CHANNEL } from './session.service';
import { AuthCode } from '../../common/auth-code.enum';
import { FakeRedis } from '../mfa/fake-redis.spec-helper';

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
    hget: jest.Mock;
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
      hget: jest.fn().mockResolvedValue('u1'),
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

  it('peekSession reads userId + method even from a revoked session', async () => {
    redis.hmget.mockResolvedValue(['u1', 'oidc']);
    await expect(service.peekSession('s1')).resolves.toEqual({
      userId: 'u1',
      method: 'oidc',
    });
    expect(redis.hmget).toHaveBeenCalledWith('sess:s1', 'userId', 'method');
    // A session created before `method` existed.
    redis.hmget.mockResolvedValue(['u1', null]);
    await expect(service.peekSession('old')).resolves.toEqual({
      userId: 'u1',
      method: '',
    });
    redis.hmget.mockResolvedValue([null, null]);
    await expect(service.peekSession('gone')).resolves.toBeNull();
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

describe('SessionService.revokeSession ownership', () => {
  let service: SessionService;
  const multiChain = {
    hset: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  const redis = { hget: jest.fn(), multi: jest.fn().mockReturnValue(multiChain) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [SessionService, { provide: REDIS_CLIENT, useValue: redis }],
    }).compile();
    service = moduleRef.get(SessionService);
  });

  it("revokes the caller's own session", async () => {
    redis.hget.mockResolvedValue('u1');
    await service.revokeSession('u1', 's1');
    expect(redis.hget).toHaveBeenCalledWith('sess:s1', 'userId');
    expect(multiChain.hset).toHaveBeenCalledWith('sess:s1', { revoked: '1' });
  });

  it("never touches another user's session", async () => {
    redis.hget.mockResolvedValue('someone-else');
    await service.revokeSession('u1', 's1');
    expect(redis.multi).not.toHaveBeenCalled();
  });

  it('an unknown or missing sid writes nothing (no stray sess:* key)', async () => {
    redis.hget.mockResolvedValue(null);
    await service.revokeSession('u1', 'nope');
    await service.revokeSession('u1', undefined as unknown as string);
    expect(redis.multi).not.toHaveBeenCalled();
  });
});

/**
 * Require SSO: sessions record how they were created, and enforcement revokes
 * only the non-SSO ones (`method !== 'oidc'`, legacy sessions included).
 */
describe('SessionService — session method + revokeSessionsNotCreatedBy', () => {
  let redis: FakeRedis;
  let service: SessionService;

  beforeEach(() => {
    redis = new FakeRedis();
    service = new SessionService(redis as never);
  });

  const methodOf = async (sid: string) => redis.hget(`sess:${sid}`, 'method');

  it('createSession stores the method (empty when not given)', async () => {
    const a = await service.createSession({ userId: 'u1', method: 'oidc' });
    const b = await service.createSession({ userId: 'u1' });
    expect(a.sid).toBe('test-sid');
    expect(await methodOf(b.sid)).toBe('');
    await service.createSession({ userId: 'u2', method: 'invite' });
    expect(await methodOf('test-sid')).toBe('invite');
  }, 30_000);

  it('revokes password / google / invite / legacy sessions, keeps oidc, publishes once', async () => {
    const seed = async (sid: string, method?: string) => {
      await redis.hset(`sess:${sid}`, {
        userId: 'u1',
        revoked: '0',
        ...(method === undefined ? {} : { method }),
      });
      await redis.sadd('user:u1:sessions', sid);
    };
    await seed('pw', 'password');
    await seed('gg', 'google');
    await seed('inv', 'invite');
    await seed('legacy');
    await seed('sso', 'oidc');

    await expect(
      service.revokeSessionsNotCreatedBy('u1', 'oidc', 'sso_enforced'),
    ).resolves.toBe(4);

    for (const sid of ['pw', 'gg', 'inv', 'legacy']) {
      expect(await redis.hget(`sess:${sid}`, 'revoked')).toBe('1');
    }
    expect(await redis.hget('sess:sso', 'revoked')).toBe('0');
    expect(await redis.smembers('user:u1:sessions')).toEqual(['sso']);
    expect(redis.published).toEqual([
      {
        channel: 'auth:sessions-revoked',
        message: JSON.stringify({ userId: 'u1', reason: 'sso_enforced' }),
      },
    ]);
  });

  it('only SSO sessions → nothing revoked, no event (live SSO sockets stay)', async () => {
    await redis.hset('sess:sso', { userId: 'u1', method: 'oidc' });
    await redis.sadd('user:u1:sessions', 'sso');
    await expect(
      service.revokeSessionsNotCreatedBy('u1', 'oidc', 'sso_enforced'),
    ).resolves.toBe(0);
    expect(redis.published).toEqual([]);
  });

  it('an expired session hash is dropped from the set, never recreated', async () => {
    await redis.sadd('user:u1:sessions', 'gone');
    await expect(
      service.revokeSessionsNotCreatedBy('u1', 'oidc', 'sso_enforced'),
    ).resolves.toBe(0);
    expect(redis.keys('sess:')).toEqual([]);
    expect(await redis.smembers('user:u1:sessions')).toEqual([]);
  });
});
