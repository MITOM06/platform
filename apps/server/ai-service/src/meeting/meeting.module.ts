import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisModule } from '../redis/redis.module';
import { UsageModule } from '../usage/usage.module';
import { MeetingContextService } from './meeting-context.service';
import { MeetingRecordClient } from './meeting-record.client';
import { MeetingSummaryService } from './meeting-summary.service';
import { MeetingSubscriberService } from './meeting-subscriber.service';
import { MEETING_REDIS_SUBSCRIBER } from './meeting.constants';

const redisLogger = new Logger('MeetingRedisSubscriber');

@Module({
  imports: [RedisModule, UsageModule],
  providers: [
    {
      // Own connection: a subscriber-mode client cannot run other commands.
      provide: MEETING_REDIS_SUBSCRIBER,
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('config.redis.url');
        const host = configService.get<string>('config.redis.host') ?? 'localhost';
        const port = configService.get<number>('config.redis.port') ?? 6379;
        const client = url
          ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null })
          : new Redis({ host, port, lazyConnect: true, maxRetriesPerRequest: null });
        client.on('error', (err) => redisLogger.error(`Redis error: ${err.message}`));
        client.on('connect', () => redisLogger.log('Meeting subscriber connected'));
        return client;
      },
      inject: [ConfigService],
    },
    MeetingRecordClient,
    MeetingContextService,
    MeetingSummaryService,
    MeetingSubscriberService,
  ],
  exports: [MeetingRecordClient, MeetingContextService],
})
export class MeetingModule {}
