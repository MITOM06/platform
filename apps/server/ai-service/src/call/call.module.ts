import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import Redis from 'ioredis';
import { RedisModule } from '../redis/redis.module';
import { CallSession, CallSessionSchema } from './call-session.schema';
import { User, UserSchema } from './user.schema';
import { CallSummaryService } from './call-summary.service';
import { CallSubscriberService } from './call-subscriber.service';
import { CALL_REDIS_SUBSCRIBER } from './call.constants';

const callSessionFeature = MongooseModule.forFeature([
  { name: CallSession.name, schema: CallSessionSchema },
  { name: User.name, schema: UserSchema },
]) as unknown as DynamicModule;

const callRedisLogger = new Logger('CallRedisSubscriber');

@Module({
  imports: [callSessionFeature, RedisModule],
  providers: [
    {
      // Own connection — a subscriber-mode client cannot run other commands,
      // so it must be separate from the shared publisher / KB subscriber.
      provide: CALL_REDIS_SUBSCRIBER,
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('config.redis.url');
        const host = configService.get<string>('config.redis.host') ?? 'localhost';
        const port = configService.get<number>('config.redis.port') ?? 6379;
        const client = url
          ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null })
          : new Redis({ host, port, lazyConnect: true, maxRetriesPerRequest: null });
        client.on('error', (err) => callRedisLogger.error(`Redis error: ${err.message}`));
        client.on('connect', () => callRedisLogger.log('Call subscriber connected'));
        return client;
      },
      inject: [ConfigService],
    },
    CallSummaryService,
    CallSubscriberService,
  ],
  exports: [CallSummaryService],
})
export class CallModule {}
