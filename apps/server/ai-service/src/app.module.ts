import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { SharedJwtStrategy } from '@platform/database';
import configuration from './config/configuration';
import { AiModule } from './ai/ai.module';
import { RedisModule } from './redis/redis.module';
import { MemoryModule } from './memory/memory.module';
import { KbModule } from './kb/kb.module';
import { ToolsModule } from './tools/tools.module';
import { UsageModule } from './usage/usage.module';
import { PersonaModule } from './persona/persona.module';
import { RetentionModule } from './retention/retention.module';
import { CallModule } from './call/call.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { SettingsModule } from './settings/settings.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { BotSeedService } from './bot/bot-seed.service';
import { RedisSubscriberService } from './redis/redis-subscriber.service';
import { HealthModule } from './health/health.module';

const mongooseModule: DynamicModule = MongooseModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    uri: configService.get<string>('config.mongodbUri'),
  }),
  inject: [ConfigService],
}) as unknown as DynamicModule;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    // Shared passport-jwt strategy so JwtAuthGuard can populate req.user for the
    // usage dashboard controller (TASK-13 — first ai-service guarded route).
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // First scheduler in ai-service (TASK-11 daily digest).
    ScheduleModule.forRoot(),
    mongooseModule,
    HealthModule,
    RedisModule,
    SettingsModule,
    MemoryModule,
    KbModule,
    ToolsModule,
    UsageModule,
    PersonaModule,
    RetentionModule,
    CallModule,
    AiModule,
    RabbitmqModule,
    SchedulerModule,
  ],
  providers: [BotSeedService, RedisSubscriberService, SharedJwtStrategy],
})
export class AppModule {}
