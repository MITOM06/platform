import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection, Model, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { TokenUsage } from './token-usage.schema';
import { Message } from './message.schema';
import { Feedback } from './feedback.schema';
import { estimateCost, PriceConfig } from './cost-estimator';
import {
  DailyUsage,
  DashboardRange,
  DashboardResponse,
  FeedbackSummary,
  PerModelTokens,
  TopUser,
  WorstAnswer,
} from './dashboard.types';

const MONTH_RE = /^\d{4}-\d{2}$/;
const DEFAULT_DAYS = 30;
const TOP_USERS_LIMIT = 10;
const WORST_ANSWERS_LIMIT = 10;
const PREVIEW_CHARS = 200;

interface ResolvedRange extends DashboardRange {
  /** Inclusive UTC start instant of `from`. */
  start: Date;
  /** Exclusive UTC instant just after `to` (next day 00:00). */
  endExclusive: Date;
}

/**
 * Aggregation service for the admin usage & quality dashboard (TASK-13).
 *
 * Sources (all read-only, shared Mongo `platform`):
 *  - token_usage  → volume over-time + top-users (no model field).
 *  - messages.trace → per-model token sums → cost (decision D5).
 *  - ai_feedback  → 👎 rate + worst-rated answers.
 *
 * `totals.totalTokens`/`requestCount` are the authoritative volume figures from
 * token_usage; `totals.estimatedCostUsd` is defined as the sum of perModelCost
 * (model-aware, from messages.trace) — the two token sources can differ slightly.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly botUserId: string;

  constructor(
    @InjectModel(TokenUsage.name) private readonly tokenUsageModel: Model<TokenUsage>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<Feedback>,
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {
    this.botUserId =
      this.config.get<string>('config.bot.userId') ??
      'ai-bot-000000000000000000000001';
  }

  async getDashboard(params: { month?: string; days?: number }): Promise<DashboardResponse> {
    const range = this.resolveRange(params);
    const prices = this.priceConfig();

    const [daily, totals, perModelTokens, feedback] = await Promise.all([
      this.dailyUsage(range),
      this.volumeTotals(range),
      this.perModelTokens(range),
      this.feedbackSummary(range),
    ]);

    const { perModel, totalUsd } = estimateCost(perModelTokens, prices);
    const topUsers = await this.topUsers(range, totals.totalTokens, totalUsd);

    return {
      range: { from: range.from, to: range.to, label: range.label },
      totals: { ...totals, estimatedCostUsd: totalUsd },
      daily,
      perModelCost: perModel,
      topUsers,
      feedback,
    };
  }

  private priceConfig(): PriceConfig {
    return {
      defaultInputPerMTok: this.config.get<number>('config.pricing.defaultInputPerMTok') ?? 3,
      defaultOutputPerMTok: this.config.get<number>('config.pricing.defaultOutputPerMTok') ?? 15,
      models: this.config.get('config.pricing.models') ?? {},
    };
  }

  /** Resolves `month` (wins) or rolling `days` into a date window. */
  private resolveRange(params: { month?: string; days?: number }): ResolvedRange {
    if (params.month) {
      if (!MONTH_RE.test(params.month)) {
        throw new BadRequestException('month must match YYYY-MM');
      }
      const [y, m] = params.month.split('-').map((n) => parseInt(n, 10));
      const start = new Date(Date.UTC(y, m - 1, 1));
      const endExclusive = new Date(Date.UTC(y, m, 1));
      const to = new Date(endExclusive.getTime() - 86400000);
      return {
        from: this.fmt(start),
        to: this.fmt(to),
        label: params.month,
        start,
        endExclusive,
      };
    }

    const days = params.days && params.days > 0 ? Math.floor(params.days) : DEFAULT_DAYS;
    const today = new Date();
    const endExclusive = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1),
    );
    const start = new Date(endExclusive.getTime() - days * 86400000);
    const to = new Date(endExclusive.getTime() - 86400000);
    return {
      from: this.fmt(start),
      to: this.fmt(to),
      label: `last ${days}d`,
      start,
      endExclusive,
    };
  }

  private fmt(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** token_usage grouped by date, zero-filled for every day in [from, to]. */
  private async dailyUsage(range: ResolvedRange): Promise<DailyUsage[]> {
    const rows = await this.tokenUsageModel
      .find({ date: { $gte: range.from, $lte: range.to } })
      .lean()
      .exec();

    const byDate = new Map<string, DailyUsage>();
    for (const r of rows) {
      const cur = byDate.get(r.date) ?? {
        date: r.date,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        requestCount: 0,
      };
      cur.inputTokens += r.inputTokens ?? 0;
      cur.outputTokens += r.outputTokens ?? 0;
      cur.totalTokens += (r.inputTokens ?? 0) + (r.outputTokens ?? 0);
      cur.requestCount += r.requestCount ?? 0;
      byDate.set(r.date, cur);
    }

    const out: DailyUsage[] = [];
    for (
      let d = new Date(range.start);
      d < range.endExclusive;
      d = new Date(d.getTime() + 86400000)
    ) {
      const key = this.fmt(d);
      out.push(
        byDate.get(key) ?? {
          date: key,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          requestCount: 0,
        },
      );
    }
    return out;
  }

  /** Authoritative volume totals from token_usage over the window. */
  private async volumeTotals(
    range: ResolvedRange,
  ): Promise<{ inputTokens: number; outputTokens: number; totalTokens: number; requestCount: number }> {
    const agg = await this.tokenUsageModel.aggregate<{
      inputTokens: number;
      outputTokens: number;
      requestCount: number;
    }>([
      { $match: { date: { $gte: range.from, $lte: range.to } } },
      {
        $group: {
          _id: null,
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          requestCount: { $sum: '$requestCount' },
        },
      },
    ]);
    const r = agg[0] ?? { inputTokens: 0, outputTokens: 0, requestCount: 0 };
    return {
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      totalTokens: (r.inputTokens ?? 0) + (r.outputTokens ?? 0),
      requestCount: r.requestCount ?? 0,
    };
  }

  /** messages.trace grouped by model (AI messages only) within the window. */
  private async perModelTokens(range: ResolvedRange): Promise<PerModelTokens[]> {
    const rows = await this.messageModel.aggregate<{
      _id: string;
      inputTokens: number;
      outputTokens: number;
      requestCount: number;
    }>([
      {
        $match: {
          senderId: this.botUserId,
          'trace.model': { $exists: true, $ne: null },
          createdAt: { $gte: range.start, $lt: range.endExclusive },
        },
      },
      {
        $group: {
          _id: '$trace.model',
          inputTokens: { $sum: { $ifNull: ['$trace.inputTokens', 0] } },
          outputTokens: { $sum: { $ifNull: ['$trace.outputTokens', 0] } },
          requestCount: { $sum: 1 },
        },
      },
    ]);
    return rows.map((r) => ({
      model: r._id,
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      requestCount: r.requestCount ?? 0,
    }));
  }

  /**
   * Top-N users by token volume from token_usage. estimatedCostUsd is a
   * pro-rated share of the model-aware total by token proportion (token_usage
   * has no model field, so a per-user model cost can't be computed exactly).
   * The AI bot user is excluded; displayName resolved best-effort.
   */
  private async topUsers(
    range: ResolvedRange,
    totalTokens: number,
    totalCostUsd: number,
  ): Promise<TopUser[]> {
    const rows = await this.tokenUsageModel.aggregate<{
      _id: string;
      totalTokens: number;
      requestCount: number;
    }>([
      { $match: { date: { $gte: range.from, $lte: range.to }, userId: { $ne: this.botUserId } } },
      {
        $group: {
          _id: '$userId',
          totalTokens: { $sum: { $add: ['$inputTokens', '$outputTokens'] } },
          requestCount: { $sum: '$requestCount' },
        },
      },
      { $sort: { totalTokens: -1 } },
      { $limit: TOP_USERS_LIMIT },
    ]);
    if (rows.length === 0) return [];

    const names = await this.resolveDisplayNames(rows.map((r) => r._id));
    return rows.map((r) => ({
      userId: r._id,
      displayName: names.get(r._id) ?? r._id,
      totalTokens: r.totalTokens ?? 0,
      requestCount: r.requestCount ?? 0,
      estimatedCostUsd:
        totalTokens > 0
          ? Math.round((((r.totalTokens ?? 0) / totalTokens) * totalCostUsd + Number.EPSILON) * 100) / 100
          : 0,
    }));
  }

  /** Best-effort userId → displayName from the shared `users` collection. */
  private async resolveDisplayNames(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (userIds.length === 0) return map;
    const objectIds: Types.ObjectId[] = [];
    for (const id of userIds) {
      if (Types.ObjectId.isValid(id) && id.length === 24) {
        objectIds.push(new Types.ObjectId(id));
      }
    }
    if (objectIds.length === 0) return map;
    try {
      const users = await this.connection
        .collection('users')
        .find({ _id: { $in: objectIds } }, { projection: { displayName: 1 } })
        .toArray();
      for (const u of users) {
        if (u.displayName) map.set(String(u._id), String(u.displayName));
      }
    } catch (err) {
      this.logger.warn(`displayName resolution failed: ${(err as Error).message}`);
    }
    return map;
  }

  /** 👎 rate + most-recent down-rated answers (joined to messages for preview). */
  private async feedbackSummary(range: ResolvedRange): Promise<FeedbackSummary> {
    const counts = await this.feedbackModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: range.start, $lt: range.endExclusive } } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);
    let up = 0;
    let down = 0;
    for (const c of counts) {
      if (c._id === 'up') up = c.count;
      else if (c._id === 'down') down = c.count;
    }
    const total = up + down;
    const thumbsDownRate = total > 0 ? down / total : 0;

    const worstAnswers = await this.worstAnswers(range);
    return { up, down, total, thumbsDownRate, worstAnswers };
  }

  private async worstAnswers(range: ResolvedRange): Promise<WorstAnswer[]> {
    const downs = await this.feedbackModel
      .find({ rating: 'down', createdAt: { $gte: range.start, $lt: range.endExclusive } })
      .sort({ createdAt: -1 })
      .limit(WORST_ANSWERS_LIMIT)
      .lean()
      .exec();
    if (downs.length === 0) return [];

    // Join answer text from messages by _id (string id → ObjectId where valid).
    const objectIds: Types.ObjectId[] = [];
    for (const fb of downs) {
      if (fb.messageId && Types.ObjectId.isValid(fb.messageId) && fb.messageId.length === 24) {
        objectIds.push(new Types.ObjectId(fb.messageId));
      }
    }
    const contentById = new Map<string, string>();
    if (objectIds.length > 0) {
      const msgs = await this.connection
        .collection('messages')
        .find({ _id: { $in: objectIds } }, { projection: { content: 1 } })
        .toArray();
      for (const m of msgs) {
        contentById.set(String(m._id), String(m.content ?? ''));
      }
    }

    return downs.map((fb) => {
      const content = (fb.messageId && contentById.get(fb.messageId)) ?? '';
      return {
        messageId: String(fb.messageId ?? ''),
        conversationId: String(fb.conversationId ?? ''),
        comment: fb.comment ? String(fb.comment) : null,
        answerPreview: content.slice(0, PREVIEW_CHARS),
        createdAt: fb.createdAt ? new Date(fb.createdAt).toISOString() : null,
      };
    });
  }
}
