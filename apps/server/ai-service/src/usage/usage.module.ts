import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenUsage, TokenUsageSchema } from './token-usage.schema';
import { UsageService } from './usage.service';
import { RateLimiterService } from './rate-limiter.service';
import { RedisModule } from '../redis/redis.module';

const usageFeature = MongooseModule.forFeature([
  { name: TokenUsage.name, schema: TokenUsageSchema },
]) as unknown as DynamicModule;

@Module({
  imports: [usageFeature, RedisModule],
  providers: [UsageService, RateLimiterService],
  exports: [UsageService, RateLimiterService],
})
export class UsageModule {}
