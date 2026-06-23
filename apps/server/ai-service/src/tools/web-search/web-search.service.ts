import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSearchProvider, WebSearchResult } from './web-search-provider.interface';
import { GenericSearchProvider } from './generic-search.provider';
import { AnthropicWebSearchProvider } from './anthropic-web-search.provider';

/**
 * Thin selector over the available web-search providers. Picks the provider
 * named by `WEB_SEARCH_PROVIDER` (default 'generic'). The tool + registry depend
 * on THIS, never on a concrete provider — so swapping providers or disabling
 * web search is a config-only change.
 *
 * `isAvailable()` is the single gate: true iff web search is enabled in config
 * AND the selected provider self-reports configured. The registry uses it to
 * decide whether to offer the `web_search` tool at all (graceful degradation).
 */
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);
  private readonly enabled: boolean;
  private readonly maxResults: number;
  private readonly provider: WebSearchProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly generic: GenericSearchProvider,
    private readonly anthropic: AnthropicWebSearchProvider,
  ) {
    this.enabled = this.config.get<boolean>('config.webSearch.enabled') ?? true;
    this.maxResults = this.config.get<number>('config.webSearch.maxResults') ?? 5;
    const providerName = this.config.get<string>('config.webSearch.provider') ?? 'generic';
    this.provider = providerName === 'anthropic' ? this.anthropic : this.generic;

    if (this.enabled && !this.provider.isConfigured()) {
      this.logger.log(
        `Web search enabled but provider '${this.provider.name}' is not configured — ` +
          `tool will not be registered.`,
      );
    }
  }

  /** Default cap on results, from config. */
  get defaultMaxResults(): number {
    return this.maxResults;
  }

  /** True iff web search is on AND a provider is ready. */
  isAvailable(): boolean {
    return this.enabled && this.provider.isConfigured();
  }

  /** Run a search via the active provider. Never throws (provider swallows errors). */
  async search(query: string, maxResults: number): Promise<WebSearchResult[]> {
    if (!this.isAvailable()) return [];
    return this.provider.search(query, maxResults);
  }
}
