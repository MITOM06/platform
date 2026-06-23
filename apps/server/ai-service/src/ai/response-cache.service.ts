import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from '../redis/redis.constants';

interface CachedAnswer {
  v: number[]; // query embedding
  a: string; // answer text
  t: number; // createdAt epoch ms
}

/**
 * Semantic response cache: reuse a recent answer when the user asks a
 * near-identical question in the SAME conversation. Deliberately conservative —
 * OFF by default, very high similarity threshold, per-conversation only, short
 * TTL — because serving a stale/approximate answer is worse than a fresh call.
 * Callers must only STORE deterministic answers (no tool calls / no RAG sources).
 *
 * Stored as a small bounded JSON list per conversation in Redis (no extra vector
 * DB). Fails soft on any Redis error.
 */
@Injectable()
export class ResponseCacheService {
  private readonly logger = new Logger(ResponseCacheService.name);
  private readonly enabled: boolean;
  private readonly threshold: number;
  private readonly ttlSec: number;
  private readonly max: number;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('config.cache.responseCacheEnabled') ?? false;
    this.threshold = this.configService.get<number>('config.cache.responseCacheThreshold') ?? 0.97;
    this.ttlSec = this.configService.get<number>('config.cache.responseCacheTtlSec') ?? 600;
    this.max = this.configService.get<number>('config.cache.responseCacheMax') ?? 20;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  private key(conversationId: string): string {
    return `ai:respcache:${conversationId}`;
  }

  /** Nearest cached answer for the query vector if it clears the threshold + TTL. */
  async lookup(conversationId: string, queryVector: number[]): Promise<string | null> {
    if (!this.enabled || !queryVector?.length) return null;
    try {
      const raw = await this.redis.get(this.key(conversationId));
      if (!raw) return null;
      const entries = JSON.parse(raw) as CachedAnswer[];
      const cutoff = Date.now() - this.ttlSec * 1000;
      let best: { score: number; answer: string } | null = null;
      for (const e of entries) {
        if (e.t < cutoff) continue;
        const score = cosine(queryVector, e.v);
        if (score >= this.threshold && (!best || score > best.score)) {
          best = { score, answer: e.a };
        }
      }
      if (best) this.logger.log(`Response cache hit for ${conversationId} (score ${best.score.toFixed(3)})`);
      return best?.answer ?? null;
    } catch (err) {
      this.logger.warn(`Response cache lookup failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Append an answer (most-recent-first, bounded) with a refreshed TTL. */
  async store(conversationId: string, queryVector: number[], answer: string): Promise<void> {
    if (!this.enabled || !queryVector?.length || !answer?.trim()) return;
    try {
      const k = this.key(conversationId);
      const raw = await this.redis.get(k);
      const entries = raw ? (JSON.parse(raw) as CachedAnswer[]) : [];
      entries.unshift({ v: queryVector, a: answer, t: Date.now() });
      const trimmed = entries.slice(0, this.max);
      await this.redis.set(k, JSON.stringify(trimmed), 'EX', this.ttlSec);
    } catch (err) {
      this.logger.warn(`Response cache store failed: ${(err as Error).message}`);
    }
  }
}

/** Cosine similarity; 0 when either vector is empty or zero-norm. */
export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
