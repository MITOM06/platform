import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import Redis from 'ioredis';
import { CALL_REDIS_SUBSCRIBER } from './call.constants';
import {
  CallSummaryService,
  CALL_SUMMARIZE_CHANNEL,
  CallSummarizeMessage,
} from './call-summary.service';

/**
 * Dedicated Redis subscriber for the `call:summarize` channel. Uses its own
 * connection (a connection in subscriber mode cannot run other commands), so
 * it stays independent of the KB subscriber and the shared publisher.
 */
@Injectable()
export class CallSubscriberService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CallSubscriberService.name);

  constructor(
    @Inject(CALL_REDIS_SUBSCRIBER) private readonly client: Redis,
    private readonly callSummaryService: CallSummaryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.client.subscribe(CALL_SUMMARIZE_CHANNEL);
      this.logger.log(`Subscribed to Redis channel: ${CALL_SUMMARIZE_CHANNEL}`);
    } catch (err) {
      this.logger.error(`Failed to subscribe to ${CALL_SUMMARIZE_CHANNEL}: ${(err as Error).message}`);
    }

    this.client.on('message', (channel: string, message: string) => {
      if (channel !== CALL_SUMMARIZE_CHANNEL) return;
      let payload: CallSummarizeMessage;
      try {
        payload = JSON.parse(message) as CallSummarizeMessage;
      } catch (err) {
        this.logger.error('Failed to parse call:summarize message', err as Error);
        return;
      }
      if (!payload?.callId || !payload?.conversationId) {
        this.logger.warn(`Ignoring malformed call:summarize message: ${message}`);
        return;
      }
      this.callSummaryService.summarize(payload).catch((err) => {
        this.logger.error(`Failed to summarize call ${payload.callId}`, err as Error);
      });
    });
  }
}
