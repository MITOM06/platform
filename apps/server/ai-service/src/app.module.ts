import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { AiModule } from './ai/ai.module';
import { RedisModule } from './redis/redis.module';
import { MemoryModule } from './memory/memory.module';
import { KbModule } from './kb/kb.module';
import { BotSeedService } from './bot/bot-seed.service';
import { RedisSubscriberService } from './redis/redis-subscriber.service';

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
    mongooseModule,
    RedisModule,
    MemoryModule,
    KbModule,
    AiModule,
  ],
  providers: [BotSeedService, RedisSubscriberService],
})
export class AppModule {}
