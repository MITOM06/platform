import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { TokenUsage } from './token-usage.schema';
import { countTokens, ModelUsageLike, TokenCounts } from './token-counts';

/** `GET /usage/quota` response — the exact numbers quota enforcement uses. */
export interface QuotaStatus {
  /** Tokens counted against the quota in the current period (input incl. cache + output). */
  used: number;
  /** Effective monthly limit (workspace override, else AI_MONTHLY_TOKEN_LIMIT). `0` blocks all. */
  limit: number;
  /** ISO instant the period started (first day of the UTC month, 00:00Z), inclusive. */
  periodStart: string;
  /** ISO instant the period ends (first day of the next UTC month, 00:00Z), exclusive. */
  periodEnd: string;
}

/**
 * The quota period: the current UTC calendar month. token_usage `date` keys are
 * UTC days (`toISOString().slice(0, 10)`), so the month prefix match below and
 * this window describe the same rows.
 */
export function quotaPeriod(now: Date = new Date()): { start: Date; end: Date; monthPrefix: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, monthPrefix: start.toISOString().slice(0, 7) };
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    @InjectModel(TokenUsage.name) private readonly tokenUsageModel: Model<TokenUsage>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Record token usage for a user on today's (UTC) row. `inputTokens` must be
   * the TOTAL prompt size (see token-counts.ts) — the quota sums exactly these
   * fields. `countRequest: false` for side calls and failed attempts: they cost
   * tokens but are not a user-facing reply.
   */
  async recordUsage(
    userId: string,
    counts: TokenCounts,
    opts: { countRequest?: boolean } = {},
  ): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    await this.tokenUsageModel.findOneAndUpdate(
      { userId, date },
      {
        $inc: {
          inputTokens: counts.inputTokens,
          outputTokens: counts.outputTokens,
          cacheCreationInputTokens: counts.cacheCreationInputTokens,
          cacheReadInputTokens: counts.cacheReadInputTokens,
          requestCount: opts.countRequest === false ? 0 : 1,
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true },
    );
  }

  /**
   * Fire-and-forget recorder for an ancillary model call (fact extraction,
   * compaction, session title, KB vision, digest, call summary). Those calls
   * were never recorded, so quota and the dashboard missed their tokens. Never
   * throws — accounting must not break the feature that made the call.
   */
  recordModelCall(
    userId: string | null | undefined,
    usage: ModelUsageLike | null | undefined,
    source: string,
  ): void {
    if (!userId) return;
    const counts = countTokens(usage);
    if (counts.inputTokens === 0 && counts.outputTokens === 0) return;
    this.recordUsage(userId, counts, { countRequest: false }).catch((err) =>
      this.logger.warn(`Usage tracking (${source}) failed for ${userId}: ${(err as Error).message}`),
    );
  }

  async getMonthlyUsage(userId: string, now: Date = new Date()): Promise<number> {
    const { monthPrefix } = quotaPeriod(now);
    const records = await this.tokenUsageModel
      .find({ userId, date: { $regex: `^${monthPrefix}` } })
      .exec();
    return records.reduce((sum, r) => sum + (r.inputTokens ?? 0) + (r.outputTokens ?? 0), 0);
  }

  /**
   * @param limitOverride workspace-resolved monthly token limit (TASK-12). When
   * provided (incl. `0` = block all), it takes precedence over the env default.
   * `undefined`/`null` ⇒ fall back to env `AI_MONTHLY_TOKEN_LIMIT`.
   */
  resolveLimit(limitOverride?: number | null): number {
    return (
      limitOverride ??
      this.configService.get<number>('config.quota.monthlyTokenLimit') ??
      500000
    );
  }

  /** Quota numbers for a user — the single computation enforcement and `GET /usage/quota` share. */
  async getQuotaStatus(
    userId: string,
    limitOverride?: number | null,
    now: Date = new Date(),
  ): Promise<QuotaStatus> {
    const { start, end } = quotaPeriod(now);
    const used = await this.getMonthlyUsage(userId, now);
    return {
      used,
      limit: this.resolveLimit(limitOverride),
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    };
  }

  async isQuotaExceeded(userId: string, limitOverride?: number | null): Promise<boolean> {
    const { used, limit } = await this.getQuotaStatus(userId, limitOverride);
    return used >= limit;
  }
}
