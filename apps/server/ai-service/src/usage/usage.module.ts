import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenUsage, TokenUsageSchema } from './token-usage.schema';
import { Message, MessageSchema } from './message.schema';
import { Feedback, FeedbackSchema } from './feedback.schema';
import { UsageService } from './usage.service';
import { RateLimiterService } from './rate-limiter.service';
import { DashboardService } from './dashboard.service';
import { UsageController } from './usage.controller';
import { RedisModule } from '../redis/redis.module';

const usageFeature = MongooseModule.forFeature([
  { name: TokenUsage.name, schema: TokenUsageSchema },
  { name: Message.name, schema: MessageSchema },
  { name: Feedback.name, schema: FeedbackSchema },
]) as unknown as DynamicModule;

@Module({
  imports: [usageFeature, RedisModule],
  controllers: [UsageController],
  providers: [UsageService, RateLimiterService, DashboardService],
  exports: [UsageService, RateLimiterService],
})
export class UsageModule {}
