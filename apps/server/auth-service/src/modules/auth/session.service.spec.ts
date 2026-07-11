// nanoid is ESM-only and Jest (CJS) cannot parse it — mock before import.
jest.mock('nanoid', () => ({ nanoid: () => 'test-sid' }));

import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { REDIS_CLIENT } from '@platform/database';
import { SessionService } from './session.service';
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
