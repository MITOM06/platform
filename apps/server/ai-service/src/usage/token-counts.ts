/**
 * Token accounting shared by every Anthropic call site — the agentic loop and
 * the side calls (fact extraction, compaction, session titles, KB vision,
 * digests, call summaries).
 *
 * Anthropic's `usage.input_tokens` is only the UNCACHED remainder of the prompt:
 *   total prompt = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
 * Prompt caching is on by default here, so recording `input_tokens` alone
 * under-counted quota and volume. Every recorder goes through `countTokens`,
 * and `inputTokens` below always means the TOTAL prompt tokens.
 */

/** The subset of an Anthropic `usage` object the counters read. */
export interface ModelUsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface TokenCounts {
  /** Total prompt tokens: uncached + cache writes + cache reads. */
  inputTokens: number;
  outputTokens: number;
  /** Subset of `inputTokens` written to the prompt cache (billed ~1.25x input). */
  cacheCreationInputTokens: number;
  /** Subset of `inputTokens` served from the prompt cache (billed ~0.1x input). */
  cacheReadInputTokens: number;
}

export function zeroTokens(): TokenCounts {
  return { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 };
}

function count(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/** Normalize one API response's `usage` into totals (missing fields count as 0). */
export function countTokens(usage: ModelUsageLike | null | undefined): TokenCounts {
  const uncached = count(usage?.input_tokens);
  const cacheCreation = count(usage?.cache_creation_input_tokens);
  const cacheRead = count(usage?.cache_read_input_tokens);
  return {
    inputTokens: uncached + cacheCreation + cacheRead,
    outputTokens: count(usage?.output_tokens),
    cacheCreationInputTokens: cacheCreation,
    cacheReadInputTokens: cacheRead,
  };
}

export function addTokens(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
  };
}

/** What the monthly quota counts: every prompt token plus every output token. */
export function quotaTokens(c: TokenCounts): number {
  return c.inputTokens + c.outputTokens;
}
