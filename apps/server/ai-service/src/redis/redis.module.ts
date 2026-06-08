import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisPublisherService } from './redis-publisher.service';

import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from './redis.constants';

const redisLogger = new Logger('RedisModule');

function createRedisClient(url: string | undefined, host: string | undefined, port: number | undefined): Redis {
  const client = url
    ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null, enableOfflineQueue: true })
    : new Redis({
        host: host ?? 'localhost',
        port: port ?? 6379,
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
      });

  // Must attach error listener — otherwise unhandled error crashes the process
  client.on('error', (err) => redisLogger.error(`Redis error: ${err.message}`));
  client.on('connect', () => redisLogger.log('Redis connected'));

  return client;
}

@Module({
  providers: [
    {
      provide: REDIS_PUBLISHER,
      useFactory: (configService: ConfigService) =>
        createRedisClient(
          configService.get<string>('config.redis.url'),
          configService.get<string>('config.redis.host'),
          configService.get<number>('config.redis.port'),
        ),
      inject: [ConfigService],
    },
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: (configService: ConfigService) =>
        createRedisClient(
          configService.get<string>('config.redis.url'),
          configService.get<string>('config.redis.host'),
          configService.get<number>('config.redis.port'),
        ),
      inject: [ConfigService],
    },
    RedisPublisherService,
  ],
  exports: [REDIS_PUBLISHER, REDIS_SUBSCRIBER, RedisPublisherService],
})
export class RedisModule {}
