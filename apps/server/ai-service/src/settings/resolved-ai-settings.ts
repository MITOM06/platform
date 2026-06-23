/**
 * Fully-resolved workspace AI settings (TASK-12). Every field has been resolved
 * against the env-var / hardcoded fallback layer, so the read paths consume
 * concrete values and never re-implement the null-vs-env logic.
 *
 * `null` is preserved ONLY where the read path needs to know "no override":
 *  - `personaName`/`defaultTone`: null ⇒ persona.service applies its own default
 *  - `modelTier`: 'auto' ⇒ run the env model router (no forced tier)
 *  - `allowedConnectors`: null ⇒ inherit connectorAllowList (no AI-specific filter)
 */
export interface ResolvedAiSettings {
  /** Workspace default assistant name, or null ⇒ persona-layer default. */
  personaName: string | null;
  /** Workspace default tone, or null ⇒ persona-layer default ('friendly'). */
  defaultTone: string | null;
  /** 'auto'|'simple'|'mid'|'complex'. 'auto' ⇒ env model router. */
  modelTier: 'auto' | 'simple' | 'mid' | 'complex';
  /** Web-search tool toggle (resolved against env WEB_SEARCH_ENABLED). */
  webSearchEnabled: boolean;
  /** Extended-thinking toggle (resolved against env AI_ENABLE_THINKING). */
  thinkingEnabled: boolean;
  /** Monthly token quota (resolved against env AI_MONTHLY_TOKEN_LIMIT). */
  monthlyTokenLimit: number;
  /**
   * AI-specific MCP connector allow-list (catalog ids), or null ⇒ no
   * AI-specific filtering (inherit the workspace-wide allow-list). `[]` ⇒ the AI
   * may use NO connectors.
   */
  allowedConnectors: string[] | null;
}

const VALID_TIERS = ['auto', 'simple', 'mid', 'complex'] as const;

/** Narrow an untrusted stored value to a valid tier; anything else ⇒ 'auto'. */
export function normalizeModelTier(value: unknown): ResolvedAiSettings['modelTier'] {
  return (VALID_TIERS as readonly string[]).includes(value as string)
    ? (value as ResolvedAiSettings['modelTier'])
    : 'auto';
}
