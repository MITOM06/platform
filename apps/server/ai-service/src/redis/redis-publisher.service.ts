import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { propagation, context } from '@opentelemetry/api';
import { REDIS_PUBLISHER } from './redis.constants';

@Injectable()
export class RedisPublisherService {
  private readonly logger = new Logger(RedisPublisherService.name);
  private readonly responsePrefix: string;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly client: Redis,
    private readonly configService: ConfigService,
  ) {
    this.responsePrefix =
      this.configService.get<string>('config.redisChannels.responsePrefix') ?? 'ai:response';
  }

  async publish(conversationId: string, payload: object): Promise<void> {
    const channel = `${this.responsePrefix}:${conversationId}`;
    const enriched: Record<string, unknown> = { ...payload, conversationId };
    // Every chat-service instance receives the same DONE event and claims it
    // once before persisting. The claim used to key on a hash of the text, so a
    // reply identical to one in the last 5 min ("Đã nhớ!", "OK") was never
    // saved. A per-reply id keeps instances deduped but replies distinct.
    if (enriched['type'] === 'AI_STREAM_DONE' && !enriched['replyId']) {
      enriched['replyId'] = randomUUID();
    }
    await this.client.publish(channel, JSON.stringify(this.injectTrace(enriched)));
    this.logger.debug(`Published to ${channel}`);
  }

  async publishToChannel(channel: string, payload: object): Promise<void> {
    await this.client.publish(channel, JSON.stringify(this.injectTrace(payload)));
    this.logger.debug(`Published to ${channel}`);
  }

  /**
   * Injects the active W3C traceparent (and tracestate) into the payload as
   * `_traceparent` / `_tracestate` fields.  The chat-service Redis subscriber
   * can read these to continue the distributed trace (task 10b).
   *
   * If no active span exists (e.g. in tests or when OTel is disabled) the
   * carrier will be empty and the payload is returned unchanged.
   */
  private injectTrace(payload: object): object {
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);
    if (Object.keys(carrier).length === 0) {
      return payload;
    }
    const extra: Record<string, string> = {};
    if (carrier['traceparent']) extra['_traceparent'] = carrier['traceparent'];
    if (carrier['tracestate']) extra['_tracestate'] = carrier['tracestate'];
    return { ...payload, ...extra };
  }
}
