import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_SUBSCRIBER } from './redis.constants';
import { KbProcessorService } from '../kb/kb-processor.service';
import { VectorStoreService } from '../kb/vector-store.service';

const KB_PROCESS_CHANNEL = 'kb:process';
const KB_DELETE_CHANNEL = 'kb:delete';

// ai:request is now consumed via RabbitMQ (AiConsumer). This subscriber
// handles only knowledge-base lifecycle events which use Redis pub/sub.
@Injectable()
export class RedisSubscriberService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisSubscriberService.name);

  private readonly kbCollection: string;

  constructor(
    @Inject(REDIS_SUBSCRIBER) private readonly client: Redis,
    private readonly kbProcessor: KbProcessorService,
    private readonly vectorStore: VectorStoreService,
    private readonly configService: ConfigService,
  ) {
    this.kbCollection =
      this.configService.get<string>('config.kb.qdrantCollection') ?? 'knowledge';
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.client.subscribe(KB_PROCESS_CHANNEL, KB_DELETE_CHANNEL);
      this.logger.log(`Subscribed to Redis channels: ${KB_PROCESS_CHANNEL}, ${KB_DELETE_CHANNEL}`);
    } catch (err) {
      this.logger.error(`Failed to subscribe to Redis channels: ${(err as Error).message}`);
    }

    this.client.on('message', async (_channel: string, message: string) => {
      if (_channel === KB_PROCESS_CHANNEL) {
        try {
          const payload = JSON.parse(message);
          this.kbProcessor.processDocument(payload).catch((err) => {
            this.logger.error('Failed to process kb:process message', err);
          });
        } catch (err) {
          this.logger.error('Failed to parse kb:process message', err);
        }
        return;
      }

      if (_channel === KB_DELETE_CHANNEL) {
        try {
          const { documentId } = JSON.parse(message);
          this.vectorStore.deleteDocument(this.kbCollection, documentId).catch((err) => {
            this.logger.error(`Failed to delete vectors for document ${documentId}`, err);
          });
        } catch (err) {
          this.logger.error('Failed to parse kb:delete message', err);
        }
        return;
      }
    });
  }
}
