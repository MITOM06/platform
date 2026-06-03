import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { REDIS_SUBSCRIBER } from './redis.module';
import { AiService } from '../ai/ai.service';

@Injectable()
export class RedisSubscriberService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private readonly requestChannel: string;

  constructor(
    @Inject(REDIS_SUBSCRIBER) private readonly client: Redis,
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {
    this.requestChannel =
      this.configService.get<string>('config.redisChannels.requestChannel') ?? 'ai:request';
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.client.subscribe(this.requestChannel);
    this.logger.log(`Subscribed to Redis channel: ${this.requestChannel}`);

    this.client.on('message', async (_channel: string, message: string) => {
      if (_channel !== this.requestChannel) return;
      try {
        const payload = JSON.parse(message);
        await this.aiService.handleRequest(payload);
      } catch (err) {
        this.logger.error('Failed to process ai:request message', err);
      }
    });
  }
}
