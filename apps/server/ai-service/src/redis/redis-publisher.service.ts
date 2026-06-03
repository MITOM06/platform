import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { REDIS_PUBLISHER } from './redis.module';

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
    await this.client.publish(channel, JSON.stringify(payload));
    this.logger.debug(`Published to ${channel}`);
  }
}
