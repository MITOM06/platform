import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TokenUsage } from './token-usage.schema';

@Injectable()
export class UsageService {
  constructor(
    @InjectModel(TokenUsage.name) private readonly tokenUsageModel: Model<TokenUsage>,
  ) {}

  async recordUsage(userId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    await this.tokenUsageModel.findOneAndUpdate(
      { userId, date },
      {
        $inc: { inputTokens, outputTokens, requestCount: 1 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true },
    );
  }
}
