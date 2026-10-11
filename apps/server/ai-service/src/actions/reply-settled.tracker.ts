import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from '../redis/redis.constants';

const KEY_PREFIX = 'ai:reply-settled:';
/** Longer than any pending action lives (10 min), so a late confirm still finds it. */
const KEY_TTL_SECONDS = 15 * 60;

export interface WaitOptions {
  timeoutMs?: number;
  pollMs?: number;
}

/**
 * Marks an AI reply as settled — its turn pair is in the session and its DONE /
 * ERROR is out — so the follow-up of an action confirmed from that reply's card
 * waits for it. A card can be confirmed while its reply is still streaming;
 * posting the follow-up at once put it above the reply holding the card and,
 * in the session, before the request it answers. Shared through Redis, since
 * the confirm may reach another instance than the one writing the reply.
 */
@Injectable()
export class ReplySettledTracker {
  private readonly logger = new Logger(ReplySettledTracker.name);

  constructor(@Inject(REDIS_PUBLISHER) private readonly redis: Redis) {}

  async markSettled(replyId: string): Promise<void> {
    await this.redis.set(`${KEY_PREFIX}${replyId}`, '1', 'EX', KEY_TTL_SECONDS);
  }

  /** True once the reply settled; false on timeout or a Redis error (never throws). */
  async waitUntilSettled(replyId: string, opts: WaitOptions = {}): Promise<boolean> {
    const timeoutMs = opts.timeoutMs ?? 90_000;
    const pollMs = opts.pollMs ?? 250;
    const deadline = Date.now() + timeoutMs;
    try {
      for (;;) {
        if (await this.redis.get(`${KEY_PREFIX}${replyId}`)) return true;
        if (Date.now() >= deadline) return false;
        await new Promise((r) => setTimeout(r, Math.min(pollMs, Math.max(deadline - Date.now(), 0))));
      }
    } catch (err) {
      this.logger.warn(`Could not check whether reply ${replyId} settled: ${(err as Error).message}`);
      return false;
    }
  }
}
