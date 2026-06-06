import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { REDIS_SUBSCRIBER } from './redis.module';
import { AiService } from '../ai/ai.service';
import { KbProcessorService } from '../kb/kb-processor.service';
import { VectorStoreService } from '../kb/vector-store.service';

const KB_PROCESS_CHANNEL = 'kb:process';
const KB_DELETE_CHANNEL = 'kb:delete';
const KB_COLLECTION = 'knowledge';

@Injectable()
export class RedisSubscriberService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private readonly requestChannel: string;

  constructor(
    @Inject(REDIS_SUBSCRIBER) private readonly client: Redis,
    private readonly aiService: AiService,
    private readonly kbProcessor: KbProcessorService,
    private readonly vectorStore: VectorStoreService,
    private readonly configService: ConfigService,
  ) {
    this.requestChannel =
      this.configService.get<string>('config.redisChannels.requestChannel') ?? 'ai:request';
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.client.subscribe(
      this.requestChannel,
      KB_PROCESS_CHANNEL,
      KB_DELETE_CHANNEL,
    );
    this.logger.log(
      `Subscribed to Redis channels: ${this.requestChannel}, ${KB_PROCESS_CHANNEL}, ${KB_DELETE_CHANNEL}`,
    );

    this.client.on('message', async (_channel: string, message: string) => {
      if (_channel === this.requestChannel) {
        try {
          const payload = JSON.parse(message);
          await this.aiService.handleRequest(payload);
        } catch (err) {
          this.logger.error('Failed to process ai:request message', err);
        }
        return;
      }

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
          this.vectorStore.deleteDocument(KB_COLLECTION, documentId).catch((err) => {
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
