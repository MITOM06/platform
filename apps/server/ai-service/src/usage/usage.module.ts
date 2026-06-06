import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenUsage, TokenUsageSchema } from './token-usage.schema';
import { UsageService } from './usage.service';

const usageFeature = MongooseModule.forFeature([
  { name: TokenUsage.name, schema: TokenUsageSchema },
]) as unknown as DynamicModule;

@Module({
  imports: [usageFeature],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
