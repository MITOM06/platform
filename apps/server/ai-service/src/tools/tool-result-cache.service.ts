import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from '../redis/redis.constants';

/**
 * Everything a cacheable tool's result may depend on besides its input. The
 * key used to be (user, tool, input) only, so `search_messages` or
 * `summarize_conversation({})` run in group X were served from cache in group Y
 * for 60 s. Results now never cross a conversation or a KB/department scope.
 */
export interface ToolCacheScope {
  userId: string;
  conversationId: string;
  departmentId?: string;
}

/**
 * Short-TTL cache of READ-ONLY tool results, keyed per (user, conversation,
 * department scope, tool, input). Saves repeat MCP/REST round-trips and the
 * tokens spent re-processing the same result within a short window. Only the
 * caller (tool-registry) decides what is cacheable — this service is a dumb
 * keyed store. Fails OPEN (cache miss) on any Redis error so tool execution is
 * never blocked.
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

  /** Exposed for tests: the Redis key a (scope, tool, input) triple maps to. */
  key(scope: ToolCacheScope, toolName: string, input: Record<string, unknown>): string {
    const hash = createHash('sha1')
      .update(
        JSON.stringify({
          c: scope.conversationId,
          d: scope.departmentId ?? null,
          i: input ?? {},
        }),
      )
      .digest('hex')
      .slice(0, 24);
    return `ai:toolcache:${scope.userId}:${toolName}:${hash}`;
  }

  async get(
    scope: ToolCacheScope,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<string | null> {
    if (!this.isEnabled) return null;
    try {
      return await this.redis.get(this.key(scope, toolName, input));
    } catch (err) {
      this.logger.warn(`Tool cache get failed: ${(err as Error).message}`);
      return null;
    }
  }

  async set(
    scope: ToolCacheScope,
    toolName: string,
    input: Record<string, unknown>,
    result: string,
  ): Promise<void> {
    if (!this.isEnabled) return;
    try {
      await this.redis.set(this.key(scope, toolName, input), result, 'EX', this.ttlSec);
    } catch (err) {
      this.logger.warn(`Tool cache set failed: ${(err as Error).message}`);
    }
  }
}
