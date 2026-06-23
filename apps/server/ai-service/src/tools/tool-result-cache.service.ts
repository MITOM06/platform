import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from '../redis/redis.constants';

/**
 * Short-TTL cache of READ-ONLY tool results, keyed per (user, tool, input).
 * Saves repeat MCP/REST round-trips and the tokens spent re-processing the same
 * result within a short window. Only the caller (tool-registry) decides what is
 * cacheable — this service is a dumb keyed store. Fails OPEN (cache miss) on any
 * Redis error so tool execution is never blocked.
 */
@Injectable()
export class ToolResultCacheService {
  private readonly logger = new Logger(ToolResultCacheService.name);
  private readonly enabled: boolean;
  private readonly ttlSec: number;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>('config.cache.toolCacheEnabled') ?? true;
    this.ttlSec = this.configService.get<number>('config.cache.toolCacheTtlSec') ?? 60;
  }

  get isEnabled(): boolean {
    return this.enabled && this.ttlSec > 0;
  }

  private key(userId: string, toolName: string, input: Record<string, unknown>): string {
    const hash = createHash('sha1').update(JSON.stringify(input ?? {})).digest('hex').slice(0, 16);
    return `ai:toolcache:${userId}:${toolName}:${hash}`;
  }

  async get(
    userId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<string | null> {
    if (!this.isEnabled) return null;
    try {
      return await this.redis.get(this.key(userId, toolName, input));
    } catch (err) {
      this.logger.warn(`Tool cache get failed: ${(err as Error).message}`);
      return null;
    }
  }

  async set(
    userId: string,
    toolName: string,
    input: Record<string, unknown>,
    result: string,
  ): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await this.redis.set(this.key(userId, toolName, input), result, 'EX', this.ttlSec);
    } catch (err) {
      this.logger.warn(`Tool cache set failed: ${(err as Error).message}`);
    }
  }
}
