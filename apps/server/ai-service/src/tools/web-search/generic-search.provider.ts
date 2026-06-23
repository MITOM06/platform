import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSearchProvider, WebSearchResult } from './web-search-provider.interface';

const TIMEOUT_MS = 8000;

/**
 * Generic search-API provider (Brave / Tavily / SerpAPI-style). Hits the
 * configured `WEB_SEARCH_API_URL` with a Bearer `WEB_SEARCH_API_KEY` and a
 * `q`/`count` query, then normalizes a handful of common response shapes into
 * `WebSearchResult[]`.
 *
 * Uses the project's native-`fetch` convention (see `mcp-connector.client.ts`).
 * Graceful-degrade: missing key ⇒ `isConfigured()` is false; any network /
 * timeout / non-2xx / parse error ⇒ `search` logs one warning and returns `[]`
 * (NEVER throws — a throw would dead-letter the AI request).
 */
@Injectable()
export class GenericSearchProvider implements WebSearchProvider {
  readonly name = 'generic';
  private readonly logger = new Logger(GenericSearchProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.config.get<string>('config.webSearch.apiKey');
  }

  private get apiUrl(): string | undefined {
    return this.config.get<string>('config.webSearch.apiUrl');
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiUrl);
  }

  async search(query: string, maxResults: number): Promise<WebSearchResult[]> {
    if (!this.isConfigured()) return [];
    const trimmed = query.trim();
    if (!trimmed) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = new URL(this.apiUrl as string);
      url.searchParams.set('q', trimmed);
      url.searchParams.set('count', String(maxResults));
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'X-Subscription-Token': this.apiKey as string, // Brave convention
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`web search returned ${res.status} — degrading to []`);
        return [];
      }
      const body = (await res.json()) as unknown;
      return this.normalize(body, maxResults);
    } catch (err) {
      this.logger.warn(`web search unavailable (${(err as Error).message}) — degrading to []`);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Normalize the common search-API response shapes into WebSearchResult[]:
   *   - Brave:   `{ web: { results: [{ title, url, description }] } }`
   *   - Tavily:  `{ results: [{ title, url, content }] }`
   *   - Generic: `{ results: [{ title, url, snippet }] }` / top-level array
   */
  private normalize(body: unknown, maxResults: number): WebSearchResult[] {
    const root = body as Record<string, unknown> | undefined;
    const rawList =
      (root?.['web'] as Record<string, unknown> | undefined)?.['results'] ??
      root?.['results'] ??
      (Array.isArray(body) ? body : undefined) ??
      [];
    if (!Array.isArray(rawList)) return [];

    return rawList
      .map((item) => {
        const r = item as Record<string, unknown>;
        const title = (r['title'] ?? r['name'] ?? '') as string;
        const url = (r['url'] ?? r['link'] ?? '') as string;
        const snippet = (r['snippet'] ?? r['description'] ?? r['content'] ?? '') as string;
        return { title: String(title), url: String(url), snippet: String(snippet) };
      })
      .filter((r) => r.url && r.title)
      .slice(0, maxResults);
  }
}
