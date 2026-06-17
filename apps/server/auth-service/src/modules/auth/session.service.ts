import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { Redis, REDIS_CLIENT } from '@platform/database';
import { AuthCode } from '../../common/auth-code.enum';

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
 *   3. Presented token matches the PREVIOUS (already-rotated) hash, or any
 *      version older than current -> theft signal. A superseded token must
 *      never be replayed. Revoke the session (optionally the whole family)
 *      and reject.
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
      'lastSeenAt', ARGV[4])
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
        refreshHash,
        prevRefreshHash: '',
        tokenVersion: initialVersion.toString(),
        revoked: '0',
        createdAt: Date.now().toString(),
        lastSeenAt: Date.now().toString(),
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
    const presentedVersion = this.parseTokenVersion(params.refreshToken);

    // 1) Does the presented token match the CURRENT refresh hash?
    const matchesCurrent = await argon2
      .verify(data.refreshHash, params.refreshToken)
      .catch(() => false);

    if (!matchesCurrent) {
      // 2) Reuse detection: a non-current token that matches the PREVIOUS hash
      //    (or carries an older-than-current version) is a replay of a token
      //    that was already rotated away => treat as theft.
      const matchesPrev = data.prevRefreshHash
        ? await argon2
            .verify(data.prevRefreshHash, params.refreshToken)
            .catch(() => false)
        : false;

      const isOlderVersion =
        presentedVersion !== null && presentedVersion < currentVersion;

      if (matchesPrev || isOlderVersion) {
        this.logger.warn(
          `Refresh-token reuse detected for user=${data.userId} sid=${params.sid} ` +
            `presentedVersion=${presentedVersion ?? 'n/a'} currentVersion=${currentVersion}. ` +
            `Revoking ${this.revokeFamilyOnReuse ? 'ALL user sessions' : 'this session'}.`,
        );
        if (this.revokeFamilyOnReuse) {
          await this.revokeAllSessions(data.userId);
        } else {
          await this.revokeSession(data.userId, params.sid);
        }
        throw new UnauthorizedException({ code: AuthCode.REFRESH_TOKEN_REUSE });
      }

      // Unknown / malformed token that matches neither current nor prev.
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

    return { userId: data.userId, newRefreshToken: newRefresh };
  }

  async revokeSession(userId: string, sid: string) {
    const key = this.sessKey(sid);
    await this.redis
      .multi()
      .hset(key, { revoked: '1' })
      .srem(this.userSessSetKey(userId), sid)
      .exec();
  }

  async revokeAllSessions(userId: string) {
    const userSessKey = this.userSessSetKey(userId);
    const sids: string[] = await this.redis.smembers(userSessKey);
    if (!sids || sids.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();
    for (const sid of sids) {
      const key = this.sessKey(sid);
      pipeline.hset(key, { revoked: '1' });
      pipeline.srem(userSessKey, sid);
    }
    await pipeline.exec();
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
