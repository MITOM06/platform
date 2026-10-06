// ── Admin usage & quality dashboard (TASK-13) ───────────────────────────────
// Mirror of ai-service `GET /usage/dashboard` (port 3002, gated by
// MANAGE_WORKSPACE). Single source of truth for the web admin dashboard.

/** The date window the dashboard covers. */
export interface UsageRange {
  /** Inclusive start, `YYYY-MM-DD`. */
  from: string
  /** Inclusive end, `YYYY-MM-DD`. */
  to: string
  /** Human label — `YYYY-MM` for a month window, else a range string. */
  label: string
}

/** Headline totals. `estimatedCostUsd` = sum of `perModelCost[].costUsd`. */
export interface UsageTotals {
  inputTokens: number
  outputTokens: number
  /** Authoritative volume figure (from token_usage rollup). */
  totalTokens: number
  requestCount: number
  /** Model-aware estimate; derived from messages.trace, may differ from token totals. */
  estimatedCostUsd: number
}

/** One point in the over-time series (token_usage rollup, zero-filled gaps). */
export interface UsageDailyPoint {
  date: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requestCount: number
}

/** Per-model cost breakdown (messages.trace grouped by model). */
export interface UsagePerModelCost {
  model: string
  inputTokens: number
  outputTokens: number
  requestCount: number
  /** Resolved from the ai-service price map (echoed for transparency). */
  inputPricePerMTok: number
  outputPricePerMTok: number
  /** round(2). */
  costUsd: number
}

/** A top consumer by tokens (token_usage grouped by user, desc). */
export interface UsageTopUser {
  userId: string
  /** Best-effort users-collection join; falls back to userId. */
  displayName: string
  totalTokens: number
  requestCount: number
  estimatedCostUsd: number
}

/** A recent 👎-rated answer in the window. */
export interface UsageWorstAnswer {
  messageId: string
  conversationId: string
  /** Optional reviewer comment. */
  comment: string | null
  /** First ~200 chars of the AI answer. */
  answerPreview: string
  /** Null when the underlying message has no timestamp. */
  createdAt: string | null
}

/** Feedback rollup for the window. */
export interface UsageFeedback {
  up: number
  down: number
  /** Rated messages with a non-cleared vote in window. */
  total: number
  /** down / total, 0..1; 0 when total === 0. */
  thumbsDownRate: number
  /** Most recent down-rated answers, limit 10. */
  worstAnswers: UsageWorstAnswer[]
}

/** `GET /usage/dashboard` response. */
export interface DashboardResponse {
  range: UsageRange
  totals: UsageTotals
  daily: UsageDailyPoint[]
  perModelCost: UsagePerModelCost[]
  topUsers: UsageTopUser[]
  feedback: UsageFeedback
}
