import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { Redis, REDIS_CLIENT } from '@platform/database';

@Injectable()
export class SessionService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

  private sessKey(sid: string) {
    return `sess:${sid}`;
  }
  private userSessSetKey(userId: string) {
    return `user:${userId}:sessions`;
  }

  private genRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  async createSession(params: { userId: string; deviceId?: string; platform?: string }) {
    const sid = nanoid(24);
    const refreshToken = this.genRefreshToken();
    const refreshHash = await argon2.hash(refreshToken);

    const ttl = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 2592000);

    const key = this.sessKey(sid);

    await this.redis.multi()
      .hset(key, {
        userId: params.userId,
        deviceId: params.deviceId ?? '',
        platform: params.platform ?? '',
        refreshHash,
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

    if (!data?.userId) throw new UnauthorizedException('Invalid session');
    if (data.revoked === '1') throw new UnauthorizedException('Session revoked');

    const ok = await argon2.verify(data.refreshHash, params.refreshToken).catch(() => false);
    if (!ok) throw new UnauthorizedException('Invalid refresh token');

    const newRefresh = this.genRefreshToken();
    const newHash = await argon2.hash(newRefresh);

    await this.redis.hset(key, {
      refreshHash: newHash,
      lastSeenAt: Date.now().toString(),
    });

    return { userId: data.userId, newRefreshToken: newRefresh };
  }

  async revokeSession(userId: string, sid: string) {
    const key = this.sessKey(sid);
    await this.redis.multi()
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
    const sids: string[] = await this.redis.smembers(this.userSessSetKey(userId));
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
          const [err, data] = result as [Error | null, Record<string, any> | null];
          if (!err && data && data.userId) {
            sessions.push({ sid: sids[i], ...data });
          }
        }
      }
    }
    return sessions;
  }
}
