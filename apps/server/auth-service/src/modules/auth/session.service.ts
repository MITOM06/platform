import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import {
  CLAIMS_CHANGED_CHANNEL,
  parseClaimsAt,
  Redis,
  REDIS_CLIENT,
} from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';
import type { SessionMethod } from './session-method';
import { markUsersClaimsStale } from './session-claims';

export { CLAIMS_CHANGED_CHANNEL };

/**
 * Redis Pub/Sub channel published at the end of every `revokeAllSessions` (and
 * of `revokeSessionsNotCreatedBy` when it revoked something).
 * Payload: `{"userId":"<id>","reason":"<reason>"}`. Other services (chat-service
 * WebSocket/STOMP, ai-service, connector-service) subscribe and drop every live
 * connection / cached session for that user immediately.
 */
export const SESSIONS_REVOKED_CHANNEL = 'auth:sessions-revoked';

/**
 * `role_changed` is no longer emitted: role / department / permission changes
 * mark the sessions claims-stale instead (see `markClaimsStale`). Kept in the
 * type because subscribers may still switch on it.
 */
export type SessionRevokeReason =
  | 'blocked'
  | 'role_changed'
  | 'password_reset'
  | 'refresh_reuse'
  | 'mfa_reset'
  | 'sso_enforced'
  | 'other';

export type { SessionMethod } from './session-method';

/**
 * Refresh-token reuse-detection (rotating refresh tokens).
 *
 * Security model
 * --------------
 * Every issued refresh token carries a monotonically increasing version,
 * encoded in the opaque token string itself as `v<n>.<random>`. The session
 * stores:
 *   - `tokenVersion`     : the version of the CURRENT (only valid) refresh token
 *   - `refreshHash`      : argon2 hash of the current refresh token
 *   - `prevRefreshHash`  : argon2 hash of the immediately-superseded token
 *
 * On rotation we distinguish three cases:
 *   1. Presented token matches the CURRENT hash AND wins the atomic version
 *      compare-and-set  -> normal rotation, version bumped.
 *   2. Presented token matches the CURRENT hash but LOSES the CAS (another
 *      concurrent refresh already bumped the version) -> benign race, reject
 *      with 401 but DO NOT revoke. This is a legitimate client refreshing
 *      twice in parallel; the winner already got a fresh token.
 *   3. Presented token matches the PREVIOUS (already-rotated) hash -> theft
 *      signal. A superseded token must never be replayed. Revoke the session
 *      (optionally the whole family) and reject.
 *
 * The `v<n>.` prefix is caller-supplied and NOT authenticated, so it never
 * decides anything on its own: a forged `v0.anything` once revoked a victim's
 * session just because 0 < current. Only a token that verifies against a
 * stored hash is classified; everything else is REFRESH_TOKEN_INVALID.
 *
 * Atomicity
 * ---------
 * argon2.verify is non-deterministic and too slow to run inside Redis, so we
 * authenticate the token in Node first, then perform the version bump + hash
 * swap with a single Lua script that does a compare-and-set on `tokenVersion`.
 * Lua scripts run atomically in Redis, so exactly one concurrent refresh can
 * win the CAS for a given version.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  // Compare-and-set rotation. Atomically: re-check the session is alive and
  // still at the expected version, then bump version, promote current hash to
  // prev, and store the new hash + lastSeenAt. Returns 1 on success, 0 if the
  // CAS lost (version moved) or the session is gone/revoked.
  // KEYS[1] = sess key
  // ARGV[1] = expectedVersion, ARGV[2] = newVersion,
  // ARGV[3] = newHash, ARGV[4] = nowMs, ARGV[5] = ttlSeconds
  private static readonly ROTATE_CAS_LUA = `
    if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
    if redis.call('HGET', KEYS[1], 'revoked') == '1' then return 0 end
    local cur = redis.call('HGET', KEYS[1], 'tokenVersion')
    if cur ~= ARGV[1] then return 0 end
    local oldHash = redis.call('HGET', KEYS[1], 'refreshHash')
    redis.call('HSET', KEYS[1],
      'tokenVersion', ARGV[2],
      'refreshHash', ARGV[3],
      'prevRefreshHash', oldHash,
      'lastSeenAt', ARGV[4],
      'rotatedAt', ARGV[4])
    redis.call('EXPIRE', KEYS[1], ARGV[5])
    return 1
  `;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private sessKey(sid: string) {
    return `sess:${sid}`;
  }
  private userSessSetKey(userId: string) {
    return `user:${userId}:sessions`;
  }

  private get ttlSeconds() {
    return Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 2592000);
  }

  // When a reuse is detected, revoke the whole user session family instead of
  // just the compromised session. Defaults to false (revoke just this session).
  private get revokeFamilyOnReuse() {
    return process.env.REFRESH_REUSE_REVOKE_ALL === 'true';
  }

  // Grace window after a rotation during which presenting the immediately-
  // superseded token is treated as a benign race (REFRESH_TOKEN_ROTATED, no
  // revoke) rather than theft. Covers staggered concurrent refreshes that the
  // CAS alone cannot: e.g. two browser tabs both read the same refresh cookie,
  // tab A rotates first, tab B's request lands 200ms later carrying the now-
  // previous token. Without the grace this revokes the session and logs the
  // user out of every tab. A real thief replaying inside the window still gets
  // a 401 and no token — it only skips the revocation.
  private get reuseGraceMs() {
    return Number(process.env.REFRESH_REUSE_GRACE_MS ?? 60_000);
  }

  // Refresh tokens are opaque to clients; we encode the version in the token so
  // rotation never changes the access-token / createSession contract.
  private genRefreshToken(version: number) {
    return `v${version}.${randomBytes(48).toString('base64url')}`;
  }

  private parseTokenVersion(token: string): number | null {
    const m = /^v(\d+)\./.exec(token);
    if (!m) return null;
    const v = Number(m[1]);
    return Number.isInteger(v) && v >= 0 ? v : null;
  }

  async createSession(params: {
    userId: string;
    deviceId?: string;
    platform?: string;
    method?: SessionMethod;
  }) {
    const sid = nanoid(24);
    const initialVersion = 0;
    const refreshToken = this.genRefreshToken(initialVersion);
    const refreshHash = await argon2.hash(refreshToken);

    const ttl = this.ttlSeconds;
    const key = this.sessKey(sid);

    await this.redis
      .multi()
      .hset(key, {
        userId: params.userId,
        deviceId: params.deviceId ?? '',
        platform: params.platform ?? '',
        method: params.method ?? '',
        refreshHash,
        prevRefreshHash: '',
        tokenVersion: initialVersion.toString(),
        revoked: '0',
        createdAt: Date.now().toString(),
        lastSeenAt: Date.now().toString(),
        rotatedAt: '0',
      })
      .expire(key, ttl)
      .sadd(this.userSessSetKey(params.userId), sid)
      .exec();

    return { sid, refreshToken };
  }

  async rotateRefreshToken(params: { sid: string; refreshToken: string }) {
    const key = this.sessKey(params.sid);
    const data = await this.redis.hgetall(key);

    if (!data?.userId) throw new UnauthorizedException({ code: AuthCode.SESSION_INVALID });
    if (data.revoked === '1')
      throw new UnauthorizedException({ code: AuthCode.SESSION_REVOKED });

    const currentVersion = Number(data.tokenVersion ?? '0');
    // Logging only — the prefix is not authenticated (see class doc).
    const presentedVersion = this.parseTokenVersion(params.refreshToken);

    // 1) Does the presented token match the CURRENT refresh hash?
    const matchesCurrent = await argon2
      .verify(data.refreshHash, params.refreshToken)
      .catch(() => false);

    if (!matchesCurrent) {
      // 2) Reuse detection: a non-current token that matches the PREVIOUS hash
      //    is a replay of a token that was already rotated away => theft.
      const matchesPrev = data.prevRefreshHash
        ? await argon2
            .verify(data.prevRefreshHash, params.refreshToken)
            .catch(() => false)
        : false;

      if (matchesPrev) {
        // Staggered benign race: the immediately-previous token presented
        // within the grace window after its rotation is a concurrent client
        // (multi-tab / retried request), not a replayed theft. Reject without
        // revoking so the client can retry with the rotated token it (or a
        // sibling tab) already holds.
        const rotatedAt = Number(data.rotatedAt ?? 0);
        if (rotatedAt > 0 && Date.now() - rotatedAt < this.reuseGraceMs) {
          throw new UnauthorizedException({
            code: AuthCode.REFRESH_TOKEN_ROTATED,
          });
        }
        this.logger.warn(
          `Refresh-token reuse detected for user=${data.userId} sid=${params.sid} ` +
            `presentedVersion=${presentedVersion ?? 'n/a'} currentVersion=${currentVersion}. ` +
            `Revoking ${this.revokeFamilyOnReuse ? 'ALL user sessions' : 'this session'}.`,
        );
        if (this.revokeFamilyOnReuse) {
          await this.revokeAllSessions(data.userId, 'refresh_reuse');
        } else {
          // Owner is known: data.userId was read from this very session hash.
          await this.markRevoked(data.userId, params.sid);
        }
        throw new UnauthorizedException({ code: AuthCode.REFRESH_TOKEN_REUSE });
      }

      // Unknown / forged / too-old token that matches neither current nor
      // prev: reject, never revoke (no proof it was ever issued).
      throw new UnauthorizedException({ code: AuthCode.REFRESH_TOKEN_INVALID });
    }

    // 3) Token is the current one. Atomically bump the version (compare-and-set)
    //    so concurrent refreshes can't both rotate. We need the new hash before
    //    the CAS (argon2 can't run in Lua), so compute it for currentVersion+1.
    const newVersion = currentVersion + 1;
    const newRefresh = this.genRefreshToken(newVersion);
    const newHash = await argon2.hash(newRefresh);

    const won = (await this.redis.eval(
      SessionService.ROTATE_CAS_LUA,
      1,
      key,
      currentVersion.toString(),
      newVersion.toString(),
      newHash,
      Date.now().toString(),
      this.ttlSeconds.toString(),
    )) as number;

    if (won !== 1) {
      // Lost the CAS: another concurrent refresh of the SAME current token
      // already advanced the version, or the session was revoked meanwhile.
      // This is a benign race (the token was genuinely current), NOT theft —
      // do not revoke, just reject so the client retries with its fresh token.
      throw new UnauthorizedException({ code: AuthCode.REFRESH_TOKEN_ROTATED });
    }

    return {
      userId: data.userId,
      newRefreshToken: newRefresh,
      // The access token minted from this refresh must not predate it (see
      // AuthService.refresh); undefined when the claims never changed.
      claimsAt: parseClaimsAt(data.claimsAt) ?? undefined,
    };
  }

  /**
   * Revoke ONE session of `userId` (logout). Only a session that belongs to
   * that user is touched: logout used to trust a client-supplied sid, so any
   * user could revoke anyone's session, and a missing sid wrote `sess:undefined`.
   * Returns whether a live session was revoked.
   */
  async revokeSession(userId: string, sid: string): Promise<boolean> {
    if (!userId || !sid) return false;
    const owner = await this.redis.hget(this.sessKey(sid), 'userId');
    if (!owner) {
      // Hash already expired: just drop the dangling id from the user's own set.
      await this.redis.srem(this.userSessSetKey(userId), sid);
      return false;
    }
    if (owner !== userId) {
      this.logger.warn(`Refused to revoke a session not owned by user=${userId}`);
      return false;
    }
    await this.markRevoked(userId, sid);
    return true;
  }

  /** Mark one session revoked. Callers must already know `userId` owns `sid`. */
  private async markRevoked(userId: string, sid: string) {
    await this.redis
      .multi()
      .hset(this.sessKey(sid), { revoked: '1' })
      .srem(this.userSessSetKey(userId), sid)
      .exec();
  }

  /**
   * Revoke every session of `userId` except `keepSid` (password change: the
   * device that changed it stays signed in, all others are signed out).
   *
   * Deliberately does NOT publish `auth:sessions-revoked`: that event carries
   * only a userId and subscribers (chat-service) close EVERY socket of the user
   * with SESSION_REVOKED — including the caller's, which would read as a logout
   * on the very device that just changed the password. The revoked sessions
   * still fail their next request (chat-service's session cache is <= 5s).
   */
  async revokeOtherSessions(userId: string, keepSid: string): Promise<number> {
    const userSessKey = this.userSessSetKey(userId);
    const sids = ((await this.redis.smembers(userSessKey)) ?? []).filter(
      (sid) => sid !== keepSid,
    );
    if (sids.length === 0) return 0;
    const pipeline = this.redis.pipeline();
    for (const sid of sids) {
      pipeline.hset(this.sessKey(sid), { revoked: '1' });
      pipeline.srem(userSessKey, sid);
    }
    await pipeline.exec();
    return sids.length;
  }

  async revokeAllSessions(
    userId: string,
    reason: SessionRevokeReason = 'other',
  ) {
    const userSessKey = this.userSessSetKey(userId);
    const sids: string[] = await this.redis.smembers(userSessKey);
    if (sids && sids.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const sid of sids) {
        const key = this.sessKey(sid);
        pipeline.hset(key, { revoked: '1' });
        pipeline.srem(userSessKey, sid);
      }
      await pipeline.exec();
    }
    // Published even when no sid is tracked: a service may still hold a live
    // socket for this user (e.g. the session set expired before the hash).
    await this.publishSessionsRevoked(userId, reason);
  }

  /**
   * The user's role / departments / permissions changed: every access token
   * issued before now carries stale claims. Sets `claimsAt = floor(now/1000)`
   * on each live `sess:{sid}` of the user (TTL kept) — validators then answer
   * `401 TOKEN_CLAIMS_STALE` for a token with `iat < claimsAt`, while the
   * session itself stays valid and `/auth/refresh` mints fresh claims — and
   * publishes `auth:claims-changed` `{"userId"}` so connected clients refresh
   * right away. Nobody is signed out (contrast `revokeAllSessions`).
   */
  async markClaimsStale(userId: string): Promise<{ sessions: number }> {
    const { sessions } = await this.markClaimsStaleForUsers([userId]);
    return { sessions };
  }

  /**
   * Batched {@link markClaimsStale} (e.g. every holder of an edited role).
   * `auth:claims-changed` is published once per user that had at least one
   * live session marked — a user without a session has no client to notify.
   */
  markClaimsStaleForUsers(
    userIds: readonly string[],
  ): Promise<{ users: number; sessions: number }> {
    return markUsersClaimsStale(this.redis, userIds, this.logger);
  }

  /** Never throws: a failed publish must not undo / fail the revoke itself. */
  private async publishSessionsRevoked(
    userId: string,
    reason: SessionRevokeReason,
  ) {
    try {
      await this.redis.publish(
        SESSIONS_REVOKED_CHANNEL,
        JSON.stringify({ userId, reason }),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to publish ${SESSIONS_REVOKED_CHANNEL} for user=${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Revokes the user's sessions that were NOT created by `keep` (Require SSO:
   * keep `oidc`). A session without a `method` (created before it was
   * recorded) counts as not `keep`. Publishes the revocation event only when
   * something was revoked, so a user with only kept sessions is left alone.
   * Returns how many sessions were revoked.
   */
  async revokeSessionsNotCreatedBy(
    userId: string,
    keep: SessionMethod,
    reason: SessionRevokeReason,
  ): Promise<number> {
    const userSessKey = this.userSessSetKey(userId);
    const sids: string[] = (await this.redis.smembers(userSessKey)) ?? [];
    if (sids.length === 0) return 0;

    const read = this.redis.pipeline();
    for (const sid of sids) read.hmget(this.sessKey(sid), 'userId', 'method');
    const rows = (await read.exec()) ?? [];

    const write = this.redis.pipeline();
    let revoked = 0;
    sids.forEach((sid, i) => {
      const [err, fields] = (rows[i] ?? [null, null]) as [
        Error | null,
        (string | null)[] | null,
      ];
      if (err) return;
      const [owner, method] = fields ?? [null, null];
      // Hash gone (expired): drop the stale sid, never recreate `sess:<sid>`.
      if (!owner) {
        write.srem(userSessKey, sid);
        return;
      }
      if (owner !== userId || method === keep) return;
      write.hset(this.sessKey(sid), { revoked: '1' });
      write.srem(userSessKey, sid);
      revoked += 1;
    });
    await write.exec();
    if (revoked > 0) await this.publishSessionsRevoked(userId, reason);
    return revoked;
  }

  /**
   * userId and `method` stored on `sess:{sid}`, ignoring the `revoked` flag
   * (null if the hash is gone). Lets refresh check the account status BEFORE
   * session validity; callers must confirm ownership with
   * refreshTokenBelongsToSession before revealing anything derived from it.
   */
  async peekSession(
    sid: string,
  ): Promise<{ userId: string; method: string } | null> {
    const [userId, method] = await this.redis.hmget(
      this.sessKey(sid),
      'userId',
      'method',
    );
    return userId ? { userId, method: method ?? '' } : null;
  }

  /** True when the token matches the current or previous refresh hash (revoked or not). */
  async refreshTokenBelongsToSession(
    sid: string,
    refreshToken: string,
  ): Promise<boolean> {
    const [refreshHash, prevRefreshHash] = await this.redis.hmget(
      this.sessKey(sid),
      'refreshHash',
      'prevRefreshHash',
    );
    for (const hash of [refreshHash, prevRefreshHash]) {
      if (hash && (await argon2.verify(hash, refreshToken).catch(() => false))) {
        return true;
      }
    }
    return false;
  }

  async listSessions(userId: string) {
    const sids: string[] = await this.redis.smembers(
      this.userSessSetKey(userId),
    );
    if (!sids || sids.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    for (const sid of sids) {
      pipeline.hgetall(this.sessKey(sid));
    }

    const results = await pipeline.exec();
    const sessions: Array<{ sid: string } & Record<string, string>> = [];

    if (results) {
      for (let i = 0; i < sids.length; i++) {
        const result = results[i];
        if (result) {
          const [err, data] = result as [
            Error | null,
            Record<string, any> | null,
          ];
          if (!err && data && data.userId) {
            sessions.push({ sid: sids[i], ...data });
          }
        }
      }
    }
    return sessions;
  }
}

