import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { REDIS_CLIENT, Redis } from '@platform/database';
import { matchTotpStep, normalizeTotpInput, TOTP_STEP_SECONDS } from './totp';

export const BACKUP_CODE_COUNT = 10;
const BACKUP_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // RFC 4648 base32
const BACKUP_CODE_LENGTH = 10;

/**
 * Per-user failure budgets, on top of the 5 attempts per mfaToken:
 * - `signin`: wrong codes across ALL mfaTokens of a user. Stops someone who
 *   knows the password from minting fresh tokens to keep guessing.
 * - `regen`: wrong codes on "regenerate backup codes" (signed-in user).
 */
export const MFA_FAILURE_LIMITS = {
  signin: { limit: 20, windowSeconds: 15 * 60 },
  regen: { limit: 5, windowSeconds: 15 * 60 },
} as const;
export type MfaFailureScope = keyof typeof MFA_FAILURE_LIMITS;

export interface NewBackupCodes {
  /** Shown to the user once, `XXXXX-XXXXX`. */
  codes: string[];
  /** sha256 hex of each normalised code; only these are stored. */
  hashes: string[];
}

/** Checks TOTP / backup codes and keeps the Redis-side counters for them. */
@Injectable()
export class MfaCodeService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Valid TOTP code that was not used before for this user. A code is accepted
   * once per time-step (RFC 6238 §5.2), so a shoulder-surfed or replayed code
   * cannot open a second session.
   */
  async checkTotp(
    userId: string,
    secret: string,
    input: unknown,
  ): Promise<boolean> {
    const step = matchTotpStep(normalizeTotpInput(input), secret);
    if (step === null) return false;
    // ±1 step window → a code stays acceptable for at most 3 steps.
    const ttl = TOTP_STEP_SECONDS * 4;
    const fresh = await this.redis.set(
      `mfa:totp-used:${userId}:${step}`,
      '1',
      'EX',
      ttl,
      'NX',
    );
    return fresh === 'OK';
  }

  /** The stored hash matching a backup code, or null. Constant-time over all hashes. */
  matchBackupCode(hashes: readonly string[], input: unknown): string | null {
    const normalized = normalizeBackupCode(input);
    if (!normalized) return null;
    const candidate = Buffer.from(hashBackupCode(normalized), 'hex');
    let match: string | null = null;
    for (const stored of hashes) {
      const buf = Buffer.from(stored, 'hex');
      if (
        buf.length === candidate.length &&
        timingSafeEqual(buf, candidate) &&
        !match
      ) {
        match = stored;
      }
    }
    return match;
  }

  newBackupCodes(): NewBackupCodes {
    const codes: string[] = [];
    const hashes: string[] = [];
    while (codes.length < BACKUP_CODE_COUNT) {
      let raw = '';
      for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
        raw += BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)];
      }
      const hash = hashBackupCode(raw);
      if (hashes.includes(hash)) continue;
      codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
      hashes.push(hash);
    }
    return { codes, hashes };
  }

  async failures(scope: MfaFailureScope, userId: string): Promise<number> {
    return Number((await this.redis.get(failureKey(scope, userId))) ?? 0);
  }

  /** Counts one wrong code; returns the new total within the window. */
  async recordFailure(scope: MfaFailureScope, userId: string): Promise<number> {
    const key = failureKey(scope, userId);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, MFA_FAILURE_LIMITS[scope].windowSeconds);
    }
    return count;
  }

  async clearFailures(scope: MfaFailureScope, userId: string): Promise<void> {
    await this.redis.del(failureKey(scope, userId));
  }
}

function failureKey(scope: MfaFailureScope, userId: string): string {
  return `mfa:fail:${scope}:${userId}`;
}

/** "abcde-fghij" / "ABCDE FGHIJ" → "ABCDEFGHIJ"; anything else → null. */
export function normalizeBackupCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const normalized = input.toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z2-7]{10}$/.test(normalized) ? normalized : null;
}

export function hashBackupCode(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}
