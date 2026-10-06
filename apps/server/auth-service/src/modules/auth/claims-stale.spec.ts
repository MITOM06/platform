// nanoid is ESM-only and Jest (CJS) cannot parse it — mock before import.
let mockSidCounter = 0;
jest.mock('nanoid', () => ({ nanoid: () => `sid-${++mockSidCounter}` }));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import {
  CLAIMS_CHANGED_CHANNEL,
  REDIS_CLIENT,
  SharedJwtStrategy,
} from '@platform/database';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { MARK_CLAIMS_STALE_LUA } from './session-claims';
import { ClaimsService, ResolvedClaims } from './claims.service';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { SsoMappingService } from './oidc/sso-mapping.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SocialProvisioningService } from './social-provisioning.service';
import { OAuthRedirectService } from './oauth-redirect.service';
import { LoginAttemptsService } from './login-attempts.service';
import { MfaChallengeService } from '../mfa/mfa-challenge.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * F1 — role / department / permission changes take effect without re-login.
 * Real SessionService + AuthService + both access-token validators (auth-service
 * JwtStrategy and the shared guard used by ai-service / connector-service) over
 * an in-memory Redis that executes the same commands (incl. the two Lua
 * scripts) the services send.
 */

type Hash = Map<string, string>;

class FakeRedis {
  hashes = new Map<string, Hash>();
  sets = new Map<string, Set<string>>();
  ttls = new Map<string, number>();
  published: Array<{ channel: string; message: string }> = [];

  private hash(key: string, create = false): Hash | undefined {
    let h = this.hashes.get(key);
    if (!h && create) {
      h = new Map();
      this.hashes.set(key, h);
    }
    return h;
  }

  async hset(key: string, ...args: any[]) {
    const h = this.hash(key, true)!;
    if (typeof args[0] === 'object') {
      for (const [f, v] of Object.entries(args[0])) h.set(f, String(v));
    } else {
      for (let i = 0; i < args.length; i += 2)
        h.set(args[i], String(args[i + 1]));
    }
    return 1;
  }
  async hget(key: string, field: string) {
    return this.hash(key)?.get(field) ?? null;
  }
  async hmget(key: string, ...fields: string[]) {
    return fields.map((f) => this.hash(key)?.get(f) ?? null);
  }
  async hgetall(key: string) {
    return Object.fromEntries(this.hash(key) ?? []);
  }
  async expire(key: string, seconds: number | string) {
    if (!this.hashes.has(key) && !this.sets.has(key)) return 0;
    this.ttls.set(key, Number(seconds));
    return 1;
  }
  async ttl(key: string) {
    if (!this.hashes.has(key) && !this.sets.has(key)) return -2;
    return this.ttls.get(key) ?? -1;
  }
  async sadd(key: string, member: string) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    this.sets.get(key)!.add(member);
    return 1;
  }
  async smembers(key: string) {
    return [...(this.sets.get(key) ?? [])];
  }
  async srem(key: string, member: string) {
    return this.sets.get(key)?.delete(member) ? 1 : 0;
  }
  async publish(channel: string, message: string) {
    this.published.push({ channel, message });
    return 1;
  }

  async eval(script: string, _numKeys: number, key: string, ...argv: string[]) {
    const h = this.hash(key);
    if (script === MARK_CLAIMS_STALE_LUA) {
      if (!h) return 0;
      if (h.get('revoked') === '1') return 2;
      const cur = Number(h.get('claimsAt'));
      if (!h.has('claimsAt') || cur < Number(argv[0]))
        h.set('claimsAt', argv[0]);
      return 1;
    }
    if (script.includes("'tokenVersion'")) {
      // SessionService.ROTATE_CAS_LUA
      const [expected, next, newHash, nowMs, ttl] = argv;
      if (!h || h.get('revoked') === '1' || h.get('tokenVersion') !== expected)
        return 0;
      h.set('prevRefreshHash', h.get('refreshHash') ?? '');
      h.set('tokenVersion', next);
      h.set('refreshHash', newHash);
      h.set('lastSeenAt', nowMs);
      h.set('rotatedAt', nowMs);
      this.ttls.set(key, Number(ttl));
      return 1;
    }
    throw new Error('FakeRedis: unknown script');
  }

  /** multi() / pipeline(): queue calls, run them in order on exec(). */
  pipeline() {
    const queued: Array<() => Promise<unknown>> = [];
    const chain: any = {
      exec: async () => {
        const out: Array<[Error | null, unknown]> = [];
        for (const run of queued) out.push([null, await run()]);
        return out;
      },
    };
    for (const cmd of [
      'hset',
      'expire',
      'sadd',
      'srem',
      'smembers',
      'eval',
      'publish',
      'hgetall',
    ]) {
      chain[cmd] = (...args: any[]) => {
        queued.push(() => (this as any)[cmd](...args));
        return chain;
      };
    }
    return chain;
  }
  multi() {
    return this.pipeline();
  }
}

const SECRET = 'claims-stale-test-secret';
const T0 = 1_700_000_000_000; // ms
const setNow = (ms: number) => jest.spyOn(Date, 'now').mockReturnValue(ms);

describe('F1 — claims-stale access tokens', () => {
  const OLD_SECRET = process.env.JWT_ACCESS_SECRET;
  let redis: FakeRedis;
  let session: SessionService;
  let auth: AuthService;
  let jwt: JwtService;
  let shared: SharedJwtStrategy;
  let local: JwtStrategy;
  let claims: ResolvedClaims;
  let ssoMapping: { getGate: jest.Mock; apply: jest.Mock };
  let oauthRedirect: { redirectWithLoginCode: jest.Mock };

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = SECRET;
  });
  afterAll(() => {
    process.env.JWT_ACCESS_SECRET = OLD_SECRET;
  });

  beforeEach(async () => {
    setNow(T0);
    redis = new FakeRedis();
    claims = {
      role: 'Member',
      perms: ['USE_PERSONAL_ASSISTANT'] as any,
      depts: [],
    };
    ssoMapping = {
      getGate: jest
        .fn()
        .mockResolvedValue({ enabled: true, allowedDomains: [] }),
      apply: jest.fn().mockResolvedValue({ changed: true }),
    };
    oauthRedirect = {
      redirectWithLoginCode: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: (k: string) =>
        ({ JWT_ACCESS_SECRET: SECRET, JWT_ACCESS_EXPIRES: '15m' })[k],
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        SessionService,
        { provide: JwtService, useValue: new JwtService() },
        { provide: REDIS_CLIENT, useValue: redis },
        {
          provide: ClaimsService,
          useValue: { resolve: jest.fn(async () => ({ ...claims })) },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ status: 'active' }),
            getHasPassword: jest.fn().mockResolvedValue(true),
          },
        },
        { provide: ConfigService, useValue: config },
        { provide: SsoMappingService, useValue: ssoMapping },
        {
          provide: NotificationsService,
          useValue: {
            createSetupNotificationsIfNeeded: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: SocialProvisioningService,
          useValue: { resolveUserId: jest.fn().mockResolvedValue('u1') },
        },
        { provide: OAuthRedirectService, useValue: oauthRedirect },
        { provide: LoginAttemptsService, useValue: {} },
        { provide: OtpService, useValue: {} },
        {
          provide: MfaChallengeService,
          useValue: { challengeIfRequired: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    auth = moduleRef.get(AuthService);
    session = moduleRef.get(SessionService);
    jwt = moduleRef.get(JwtService);
    shared = new SharedJwtStrategy(redis as any);
    local = new JwtStrategy(config as any, redis as any);
  });

  afterEach(() => jest.restoreAllMocks());

  const user = { _id: 'u1', email: 'jane@acme.com', displayName: 'Jane' };
  const decode = (token: string) => jwt.verify(token, { secret: SECRET });

  /** Validate through BOTH validators; returns the shared guard's result or 401 code. */
  async function check(token: string): Promise<string> {
    const payload = decode(token);
    const outcomes: string[] = [];
    for (const run of [
      () => shared.validate(payload),
      () => local.validate({} as any, payload),
    ]) {
      try {
        await run();
        outcomes.push('OK');
      } catch (e: any) {
        outcomes.push(`${e.getStatus()} ${e.getResponse().code}`);
      }
    }
    expect(outcomes[1]).toBe(outcomes[0]); // both services agree
    return outcomes[0];
  }

  it('token minted before markClaimsStale → 401 TOKEN_CLAIMS_STALE; the token from /auth/refresh passes with fresh claims', async () => {
    const login = await auth.issueTokensForUser(user, 'web-login', 'web');
    await expect(check(login.accessToken)).resolves.toBe('OK');

    // 5s later an admin promotes the user.
    setNow(T0 + 5_000);
    claims = { role: 'Admin', perms: ['MANAGE_MEMBERS'] as any, depts: ['d1'] };
    await expect(session.markClaimsStale('u1')).resolves.toEqual({
      sessions: 1,
    });

    await expect(check(login.accessToken)).resolves.toBe(
      '401 TOKEN_CLAIMS_STALE',
    );

    // Same second as the change: refresh still works on the claims-stale session.
    setNow(T0 + 5_400);
    const refreshed = await auth.refresh(login.sid, login.refreshToken);
    await expect(check(refreshed.accessToken)).resolves.toBe('OK');
    expect(decode(refreshed.accessToken)).toMatchObject({
      sub: 'u1',
      sid: login.sid,
      role: 'Admin',
      perms: ['MANAGE_MEMBERS'],
      depts: ['d1'],
    });

    // The old token stays rejected.
    await expect(check(login.accessToken)).resolves.toBe(
      '401 TOKEN_CLAIMS_STALE',
    );
  });

  it('a token minted earlier in the SAME second as the change is stale too', async () => {
    setNow(T0 + 7_100);
    const login = await auth.issueTokensForUser(user, 'web-login', 'web');
    setNow(T0 + 7_900); // same wall-clock second as the login
    claims = { role: 'Admin', perms: ['MANAGE_MEMBERS'] as any, depts: [] };
    await session.markClaimsStale('u1');

    await expect(check(login.accessToken)).resolves.toBe(
      '401 TOKEN_CLAIMS_STALE',
    );
    // ...and a refresh in that same second still yields a passing token.
    const refreshed = await auth.refresh(login.sid, login.refreshToken);
    await expect(check(refreshed.accessToken)).resolves.toBe('OK');
  });

  it('keeps the session TTL, does not sign anyone out, publishes auth:claims-changed {userId}', async () => {
    const a = await auth.issueTokensForUser(user, 'phone', 'mobile');
    const b = await auth.issueTokensForUser(user, 'laptop', 'web');
    redis.ttls.set(`sess:${a.sid}`, 1234);
    setNow(T0 + 10_000);

    await session.markClaimsStale('u1');

    for (const sid of [a.sid, b.sid]) {
      // One second ahead of the change (JWT iat only has 1 s resolution).
      expect(redis.hashes.get(`sess:${sid}`)?.get('claimsAt')).toBe(
        String((T0 + 10_000) / 1000 + 1),
      );
      expect(redis.hashes.get(`sess:${sid}`)?.get('revoked')).toBe('0');
    }
    expect(await redis.ttl(`sess:${a.sid}`)).toBe(1234);
    expect(redis.published).toEqual([
      {
        channel: CLAIMS_CHANGED_CHANNEL,
        message: JSON.stringify({ userId: 'u1' }),
      },
    ]);
    expect(CLAIMS_CHANGED_CHANNEL).toBe('auth:claims-changed');
  });

  it('skips revoked sessions, never recreates an expired hash, prunes dangling sids', async () => {
    const live = await auth.issueTokensForUser(user, 'phone', 'mobile');
    await redis.sadd('user:u1:sessions', 'gone'); // hash expired, sid left behind
    await redis.hset('sess:revoked-one', { userId: 'u1', revoked: '1' });
    await redis.sadd('user:u1:sessions', 'revoked-one');

    await expect(session.markClaimsStale('u1')).resolves.toEqual({
      sessions: 1,
    });

    expect(redis.hashes.has('sess:gone')).toBe(false);
    expect(redis.hashes.get('sess:revoked-one')?.has('claimsAt')).toBe(false);
    expect(await redis.smembers('user:u1:sessions')).toEqual(
      expect.arrayContaining([live.sid, 'revoked-one']),
    );
    expect(await redis.smembers('user:u1:sessions')).not.toContain('gone');
  });

  it('a user without live sessions is a no-op (nothing written, nothing published)', async () => {
    await expect(session.markClaimsStale('nobody')).resolves.toEqual({
      sessions: 0,
    });
    expect(redis.published).toEqual([]);
    expect(redis.hashes.size).toBe(0);
  });

  it('claimsAt only moves forward', async () => {
    const s = await auth.issueTokensForUser(user, 'phone', 'mobile');
    setNow(T0 + 60_000);
    await session.markClaimsStale('u1');
    setNow(T0 + 1_000); // another instance with a slower clock
    await session.markClaimsStale('u1');
    expect(redis.hashes.get(`sess:${s.sid}`)?.get('claimsAt')).toBe(
      String((T0 + 60_000) / 1000 + 1),
    );
  });

  it('refresh on an instance whose clock is behind claimsAt still mints a passing token', async () => {
    const login = await auth.issueTokensForUser(user, 'web-login', 'web');
    setNow(T0 + 30_000);
    await session.markClaimsStale('u1');
    setNow(T0 + 28_000); // 2s behind the instance that marked the claims
    const refreshed = await auth.refresh(login.sid, login.refreshToken);
    expect(decode(refreshed.accessToken).iat).toBe((T0 + 30_000) / 1000 + 1);
    await expect(check(refreshed.accessToken)).resolves.toBe('OK');
  });

  it('markClaimsStaleForUsers marks many users in batches and publishes once per marked user', async () => {
    await auth.issueTokensForUser({ ...user, _id: 'u1' }, 'a', 'web');
    await auth.issueTokensForUser({ ...user, _id: 'u2' }, 'b', 'web');
    await auth.issueTokensForUser({ ...user, _id: 'u2' }, 'c', 'web');

    await expect(
      session.markClaimsStaleForUsers(['u1', 'u2', 'u2', 'u3', '']),
    ).resolves.toEqual({ users: 2, sessions: 3 });
    expect(
      redis.published.map((p) => JSON.parse(p.message).userId).sort(),
    ).toEqual(['u1', 'u2']);
  });

  it('a failed publish never fails the mark; a failed mark surfaces', async () => {
    await auth.issueTokensForUser(user, 'phone', 'mobile');
    jest.spyOn(redis, 'publish').mockRejectedValue(new Error('redis down'));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(session.markClaimsStale('u1')).resolves.toEqual({
      sessions: 1,
    });

    jest.spyOn(redis, 'smembers').mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(session.markClaimsStale('u1')).rejects.toThrow('ECONNREFUSED');
  });

  it('revocation still wins: a revoked session answers SESSION_REVOKED, not TOKEN_CLAIMS_STALE', async () => {
    const login = await auth.issueTokensForUser(user, 'phone', 'mobile');
    setNow(T0 + 5_000);
    await session.markClaimsStale('u1');
    await session.revokeAllSessions('u1', 'blocked');
    await expect(check(login.accessToken)).resolves.toBe('401 SESSION_REVOKED');
  });

  it('SSO login whose group mapping changed the role marks claims stale instead of revoking', async () => {
    const other = await auth.issueTokensForUser(user, 'phone', 'mobile');
    setNow(T0 + 5_000);
    const revoke = jest.spyOn(session, 'revokeAllSessions');

    await auth.handleOidcLogin(
      {
        email: 'jane@acme.com',
        displayName: 'Jane',
        id: 'oidc-1',
        groups: ['admins'],
      },
      {} as any,
      'web',
    );

    expect(revoke).not.toHaveBeenCalled();
    await expect(check(other.accessToken)).resolves.toBe(
      '401 TOKEN_CLAIMS_STALE',
    );
    expect(oauthRedirect.redirectWithLoginCode).toHaveBeenCalledWith(
      'u1',
      {},
      'web',
      // OIDC sign-in is exempt from PON 2FA (the IdP owns MFA).
      'oidc',
    );

    // Unchanged mapping → nothing marked.
    ssoMapping.apply.mockResolvedValue({ changed: false });
    const mark = jest.spyOn(session, 'markClaimsStale');
    await auth.handleOidcLogin(
      {
        email: 'jane@acme.com',
        displayName: 'Jane',
        id: 'oidc-1',
        groups: ['admins'],
      },
      {} as any,
      'web',
    );
    expect(mark).not.toHaveBeenCalled();
  });
});
