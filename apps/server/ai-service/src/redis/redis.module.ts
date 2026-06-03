import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisPublisherService } from './redis-publisher.service';

export const REDIS_PUBLISHER = 'REDIS_PUBLISHER';
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';

@Module({
  providers: [
    {
      provide: REDIS_PUBLISHER,
      useFactory: (configService: ConfigService) =>
        new Redis({
          host: configService.get<string>('config.redis.host'),
          port: configService.get<number>('config.redis.port'),
          lazyConnect: false,
        }),
      inject: [ConfigService],
    },
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: (configService: ConfigService) =>
        new Redis({
          host: configService.get<string>('config.redis.host'),
          port: configService.get<number>('config.redis.port'),
          lazyConnect: false,
        }),
      inject: [ConfigService],
    },
    RedisPublisherService,
  ],
  exports: [REDIS_PUBLISHER, REDIS_SUBSCRIBER, RedisPublisherService],
})
export class RedisModule {}
