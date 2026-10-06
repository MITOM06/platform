import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenUsage, TokenUsageSchema } from './token-usage.schema';
import { Message, MessageSchema } from './message.schema';
import { Feedback, FeedbackSchema } from './feedback.schema';
import { UsageService } from './usage.service';
import { RateLimiterService } from './rate-limiter.service';
import { DashboardService } from './dashboard.service';
import { QuotaService } from './quota.service';
import { UsageController } from './usage.controller';
import { RedisModule } from '../redis/redis.module';
import { SettingsModule } from '../settings/settings.module';

const usageFeature = MongooseModule.forFeature([
  { name: TokenUsage.name, schema: TokenUsageSchema },
  { name: Message.name, schema: MessageSchema },
  { name: Feedback.name, schema: FeedbackSchema },
]) as unknown as DynamicModule;

@Module({
  // SettingsModule: QuotaService resolves the workspace monthlyTokenLimit the
  // same way AiService does before enforcing it.
  imports: [usageFeature, RedisModule, SettingsModule],
  controllers: [UsageController],
  providers: [UsageService, RateLimiterService, DashboardService, QuotaService],
  exports: [UsageService, RateLimiterService],
})
export class UsageModule {}
