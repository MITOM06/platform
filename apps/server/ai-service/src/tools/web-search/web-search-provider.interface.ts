/** A single web search hit, normalized across providers. */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Pluggable web-search backend. Implementations are swappable and self-report
 * whether they are usable, so the tool degrades gracefully when nothing is
 * configured. `search` MUST NOT throw — on any error it returns `[]`.
 */
export interface WebSearchProvider {
  /** Stable provider key (e.g. 'generic', 'anthropic'), for logging/selection. */
  readonly name: string;
  /** True iff this provider has the config (key/url) it needs to run. */
  isConfigured(): boolean;
  /** Execute a search. Never throws; returns [] on empty/error. */
  search(query: string, maxResults: number): Promise<WebSearchResult[]>;
}
