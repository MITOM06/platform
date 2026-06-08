import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisPublisherService } from './redis-publisher.service';

import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from './redis.constants';

@Module({
  providers: [
    {
      provide: REDIS_PUBLISHER,
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('config.redis.url');
        return redisUrl
          ? new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 })
          : new Redis({
              host: configService.get<string>('config.redis.host'),
              port: configService.get<number>('config.redis.port'),
              lazyConnect: false,
              maxRetriesPerRequest: 3,
            });
      },
      inject: [ConfigService],
    },
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('config.redis.url');
        return redisUrl
          ? new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 })
          : new Redis({
              host: configService.get<string>('config.redis.host'),
              port: configService.get<number>('config.redis.port'),
              lazyConnect: false,
              maxRetriesPerRequest: 3,
            });
      },
      inject: [ConfigService],
    },
    RedisPublisherService,
  ],
  exports: [REDIS_PUBLISHER, REDIS_SUBSCRIBER, RedisPublisherService],
})
export class RedisModule {}
