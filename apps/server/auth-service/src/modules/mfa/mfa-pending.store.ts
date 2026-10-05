import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { REDIS_CLIENT, Redis } from '@platform/database';

export const MFA_TOKEN_TTL_SECONDS = 5 * 60;
/** Lifetime of a `codes_pending` record, counted from enroll/confirm. */
export const MFA_CODES_PENDING_TTL_SECONDS = 10 * 60;
export const MFA_MAX_ATTEMPTS = 5;

/**
 * `enroll` = first sign-in, set up the authenticator; `verify` = enter a code;
 * `codes_pending` = enrolled, the backup codes were issued but not yet
 * acknowledged (no session exists until enroll/complete).
 */
export type MfaStage = 'enroll' | 'verify' | 'codes_pending';
const STAGES: readonly string[] = ['enroll', 'verify', 'codes_pending'];

export interface MfaSignInContext {
  deviceId: string;
  platform: string;
}

export interface MfaPending extends MfaSignInContext {
  /** Redis key of this record (`mfa:pending:<sha256(token)>`). */
  key: string;
  userId: string;
  stage: MfaStage;
  attempts: number;
  /** Pending (unconfirmed) TOTP secret, encrypted. Set by enroll/start. */
  secretEnc?: string;
  /** `codes_pending` only: the issued backup codes (JSON array), encrypted. */
  backupCodesEnc?: string;
  /** `codes_pending` only: `User.mfa.enrolledAt` (epoch ms) of this enrollment. */
  enrolledAt?: number;
}

/** What enroll/confirm leaves for enroll/codes and enroll/complete. */
export interface MfaCodesPendingRecord extends MfaSignInContext {
  userId: string;
  backupCodesEnc: string;
  enrolledAt: number;
}

/**
 * Pending second step of a sign-in, between a correct password / Google login
 * and the 2FA code. The client holds an opaque token (32 random bytes,
 * base64url); Redis holds a hash keyed by its sha256, so a Redis dump cannot be
 * replayed. TTL 5 min, single use on success, burned after 5 wrong codes.
 * A confirmed enrollment turns the record into `codes_pending` (TTL 10 min from
 * confirm) until enroll/complete consumes it.
 *
 * Writes that could land after the key expired (HINCRBY / HSETNX recreate a
 * missing hash without a TTL) run in MULTI with a TTL probe: a record without a
 * TTL is a resurrected one, so it is deleted and treated as expired.
 */
@Injectable()
export class MfaPendingStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async create(
    record: { userId: string; stage: MfaStage } & MfaSignInContext,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const key = pendingKey(token);
    await this.redis
      .multi()
      .hset(key, {
        userId: record.userId,
        stage: record.stage,
        deviceId: record.deviceId,
        platform: record.platform,
        attempts: '0',
      })
      .expire(key, MFA_TOKEN_TTL_SECONDS)
      .exec();
    return token;
  }

  async get(token: unknown): Promise<MfaPending | null> {
    if (typeof token !== 'string' || token.length === 0 || token.length > 256) {
      return null;
    }
    const key = pendingKey(token);
    const h = await this.redis.hgetall(key);
    if (!h?.userId || !STAGES.includes(h.stage)) return null;
    const p: MfaPending = {
      key,
      userId: h.userId,
      stage: h.stage as MfaStage,
      deviceId: h.deviceId,
      platform: h.platform,
      attempts: Number(h.attempts ?? 0),
      secretEnc: h.secretEnc || undefined,
    };
    if (p.stage === 'codes_pending') {
      const enrolledAt = Number(h.enrolledAt);
      p.backupCodesEnc = h.backupCodesEnc || undefined;
      p.enrolledAt = Number.isFinite(enrolledAt) ? enrolledAt : undefined;
    }
    return p;
  }

  /**
   * Re-opens a record the caller just consumed (enroll/confirm) as
   * `codes_pending` under the same token: the pending secret is dropped, the
   * TTL restarts at 10 minutes. Replaces anything a racing write left there.
   */
  async openCodesPending(
    key: string,
    record: MfaCodesPendingRecord,
  ): Promise<void> {
    await this.redis
      .multi()
      .del(key)
      .hset(key, {
        userId: record.userId,
        stage: 'codes_pending',
        deviceId: record.deviceId,
        platform: record.platform,
        attempts: '0',
        backupCodesEnc: record.backupCodesEnc,
        enrolledAt: String(record.enrolledAt),
      })
      .expire(key, MFA_CODES_PENDING_TTL_SECONDS)
      .exec();
  }

  /** Stores the pending secret unless one exists; returns the stored one (null = expired). */
  async setSecretIfAbsent(
    key: string,
    secretEnc: string,
  ): Promise<string | null> {
    const res = await this.redis
      .multi()
      .hsetnx(key, 'secretEnc', secretEnc)
      .hget(key, 'secretEnc')
      .ttl(key)
      .exec();
    if (!res || (await this.dropIfResurrected(key, res[2]?.[1]))) return null;
    return (res[1]?.[1] as string | null) ?? null;
  }

  /** Counts a wrong code; returns the attempts so far (null = expired). */
  async recordFailure(key: string): Promise<number | null> {
    const res = await this.redis
      .multi()
      .hincrby(key, 'attempts', 1)
      .ttl(key)
      .exec();
    if (!res || (await this.dropIfResurrected(key, res[1]?.[1]))) return null;
    return Number(res[0]?.[1]);
  }

  /** Single use: true for exactly one caller, even under concurrent requests. */
  async consume(key: string): Promise<boolean> {
    return (await this.redis.del(key)) === 1;
  }

  private async dropIfResurrected(key: string, ttl: unknown): Promise<boolean> {
    if (Number(ttl) >= 0) return false;
    await this.redis.del(key);
    return true;
  }
}

function pendingKey(token: string): string {
  return `mfa:pending:${createHash('sha256').update(token).digest('hex')}`;
}
