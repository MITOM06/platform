import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { TokenUsage } from './token-usage.schema';

@Injectable()
export class UsageService {
  constructor(
    @InjectModel(TokenUsage.name) private readonly tokenUsageModel: Model<TokenUsage>,
    private readonly configService: ConfigService,
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

  async getMonthlyUsage(userId: string): Promise<number> {
    const prefix = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const records = await this.tokenUsageModel
      .find({ userId, date: { $regex: `^${prefix}` } })
      .exec();
    return records.reduce((sum, r) => sum + (r.inputTokens ?? 0) + (r.outputTokens ?? 0), 0);
  }

  /**
   * @param limitOverride workspace-resolved monthly token limit (TASK-12). When
   * provided (incl. `0` = block all), it takes precedence over the env default.
   * `undefined`/`null` ⇒ fall back to env `AI_MONTHLY_TOKEN_LIMIT`.
   */
  async isQuotaExceeded(userId: string, limitOverride?: number | null): Promise<boolean> {
    const limit =
      limitOverride ??
      this.configService.get<number>('config.quota.monthlyTokenLimit') ??
      500000;
    const used = await this.getMonthlyUsage(userId);
    return used >= limit;
  }
}
