import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from '../redis/redis.constants';

export type RateLimitReason = 'rate' | 'concurrency';

export interface RateLimitDecision {
  allowed: boolean;
  reason?: RateLimitReason;
  /** Releases the in-flight concurrency slot. Safe to call exactly once. */
  release: () => Promise<void>;
}

const NOOP_RELEASE = async (): Promise<void> => {};

/**
 * Per-user request throttling, distinct from the monthly token quota:
 *  - fixed 60s window cap on request count (burst / abuse guard)
 *  - in-flight concurrency cap (prevents a single user monopolising workers)
 *
 * Redis-backed so it holds across multiple ai-service instances. Fails OPEN:
 * if Redis is unavailable the request is allowed (availability > throttling),
 * mirroring how the rest of the service degrades gracefully.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly enabled: boolean;
  private readonly maxPerMin: number;
  private readonly maxConcurrent: number;
  /** Safety TTL so a crashed worker can't leak a concurrency slot forever. */
  private readonly concurrencyTtlSec = 120;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('config.rateLimit.enabled') ?? true;
    this.maxPerMin = this.configService.get<number>('config.rateLimit.maxRequestsPerMin') ?? 20;
    this.maxConcurrent = this.configService.get<number>('config.rateLimit.maxConcurrent') ?? 3;
  }

  /**
   * Atomically checks the per-minute window then the concurrency cap. On
   * success returns a `release()` that frees the concurrency slot — the caller
   * MUST invoke it (in a finally) once the request finishes.
   */
  async acquire(userId: string): Promise<RateLimitDecision> {
    if (!this.enabled) return { allowed: true, release: NOOP_RELEASE };

    try {
      // --- fixed-window request rate ---
      const windowKey = `ai:rl:req:${userId}:${Math.floor(Date.now() / 60000)}`;
      const count = await this.redis.incr(windowKey);
      if (count === 1) await this.redis.expire(windowKey, 60);
      if (count > this.maxPerMin) {
        return { allowed: false, reason: 'rate', release: NOOP_RELEASE };
      }

      // --- in-flight concurrency ---
      const concKey = `ai:rl:conc:${userId}`;
      const inFlight = await this.redis.incr(concKey);
      await this.redis.expire(concKey, this.concurrencyTtlSec);
      if (inFlight > this.maxConcurrent) {
        await this.redis.decr(concKey);
        return { allowed: false, reason: 'concurrency', release: NOOP_RELEASE };
      }

      let released = false;
      const release = async (): Promise<void> => {
        if (released) return;
        released = true;
        try {
          await this.redis.decr(concKey);
        } catch (err) {
          this.logger.warn(`Failed to release concurrency slot for ${userId}: ${(err as Error).message}`);
        }
      };
      return { allowed: true, release };
    } catch (err) {
      // Fail open — never block the assistant because the limiter backend hiccuped.
      this.logger.warn(`Rate limiter unavailable, allowing request for ${userId}: ${(err as Error).message}`);
      return { allowed: true, release: NOOP_RELEASE };
    }
  }
}
