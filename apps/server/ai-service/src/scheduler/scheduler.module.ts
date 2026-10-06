import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '../redis/redis.module';
import { SettingsModule } from '../settings/settings.module';
import { UsageModule } from '../usage/usage.module';
import { DigestLog, DigestLogSchema } from './digest-log.schema';
import { DailyDigestCron } from './daily-digest.cron';
import { DigestGeneratorService } from './digest-generator.service';

const digestLogFeature = MongooseModule.forFeature([
  { name: DigestLog.name, schema: DigestLogSchema },
]) as unknown as DynamicModule;

/**
 * Scheduler module (TASK-11). Owns the daily-digest cron + generator and the
 * `ai_digest_log` idempotency model. Depends on the cached workspace settings
 * (SettingsModule) for the opt-in flags, on RedisModule for the
 * `RedisPublisherService` delivery path and on UsageModule to record the digest
 * model calls. `ScheduleModule.forRoot()` is registered once in AppModule.
 */
@Module({
  imports: [digestLogFeature, SettingsModule, RedisModule, UsageModule],
  providers: [DailyDigestCron, DigestGeneratorService],
  exports: [DigestGeneratorService],
})
export class SchedulerModule {}
