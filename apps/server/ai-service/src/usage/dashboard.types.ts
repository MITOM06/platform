/**
 * Frozen response contract for `GET /usage/dashboard` (TASK-13). Web + mobile
 * build against these exact field names/types — do not rename without updating
 * both clients. See _workspace/01_plan.md API Contract.
 */

export interface DashboardRange {
  /** YYYY-MM-DD (inclusive). */
  from: string;
  /** YYYY-MM-DD (inclusive). */
  to: string;
  /** Human label: the YYYY-MM month, or `"last Nd"` for a rolling window. */
  label: string;
}

export interface DashboardTotals {
  inputTokens: number;
  outputTokens: number;
  /** Authoritative volume figure (from token_usage). */
  totalTokens: number;
  requestCount: number;
  /** Sum of perModelCost[].costUsd (model-aware, from messages.trace). */
  estimatedCostUsd: number;
}

export interface DailyUsage {
  /** YYYY-MM-DD. */
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
}

export interface PerModelCost {
  model: string;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  /** Resolved from the price map; echoed for transparency. USD / 1M tokens. */
  inputPricePerMTok: number;
  outputPricePerMTok: number;
  /** round(2). */
  costUsd: number;
}

export interface TopUser {
  userId: string;
  /** Resolved via users collection (best-effort); falls back to userId. */
  displayName: string;
  totalTokens: number;
  requestCount: number;
  /** Pro-rated share of total estimated cost by token volume. round(2). */
  estimatedCostUsd: number;
}

export interface WorstAnswer {
  messageId: string;
  conversationId: string;
  /** May be null (no free-text comment left). */
  comment: string | null;
  /** First ~200 chars of messages.content; '' if the message is gone. */
  answerPreview: string;
  /** ISO string. */
  createdAt: string | null;
}

export interface FeedbackSummary {
  up: number;
  down: number;
  /** Rated messages with a non-cleared vote in window. */
  total: number;
  /** down / total (0..1); 0 when total == 0 (never NaN). */
  thumbsDownRate: number;
  worstAnswers: WorstAnswer[];
}

export interface DashboardResponse {
  range: DashboardRange;
  totals: DashboardTotals;
  daily: DailyUsage[];
  perModelCost: PerModelCost[];
  topUsers: TopUser[];
  feedback: FeedbackSummary;
}

/** Input to the pure cost estimator: per-model raw token sums. */
export interface PerModelTokens {
  model: string;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
}
