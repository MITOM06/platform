import { Injectable, Logger } from '@nestjs/common';
import { WebSearchProvider, WebSearchResult } from './web-search-provider.interface';

/**
 * Anthropic web-search provider — DOCUMENTED NO-OP STUB.
 *
 * Decision (plan TASK-09, integration option "a"): Anthropic exposes web search
 * as a SERVER-SIDE tool — the model emits a `web_search_tool_use` block and
 * Anthropic executes it WITHIN the same `messages` request, returning
 * `web_search_tool_result` + citation blocks in the stream. That is a different
 * execution model from this service's custom in-loop tool dispatch (where WE
 * execute the tool and feed back a `tool_result`). It cannot be implemented as a
 * synchronous `search()` call — it would require passing Anthropic's server-tool
 * spec through `buildTools` and harvesting result/citation blocks out of the
 * stream parser in `_agenticLoop` (option "b").
 *
 * To keep ONE citation path and ship the recommended default, web search is
 * routed through the generic custom-tool provider instead. This provider
 * therefore reports `isConfigured() === false` (graceful no-op): selecting
 * `WEB_SEARCH_PROVIDER=anthropic` without wiring (b) means web search is simply
 * not registered, exactly like an unconfigured key.
 *
 * To wire option (b) later: consult the `claude-api` skill for the current
 * server-tool type id + result/citation block shapes, add the tool spec in
 * `AiService.buildTools`, and harvest citations into `ctx.sourceSink` in the
 * `_agenticLoop` stream handler — NOT here.
 */
@Injectable()
export class AnthropicWebSearchProvider implements WebSearchProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicWebSearchProvider.name);

  isConfigured(): boolean {
    return false; // server-side tool — not wired into the custom loop (see header).
  }

  async search(_query: string, _maxResults: number): Promise<WebSearchResult[]> {
    this.logger.debug('Anthropic web-search provider is a no-op stub; returning []');
    return [];
  }
}
