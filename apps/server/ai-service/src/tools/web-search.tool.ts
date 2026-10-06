import { Injectable, Logger } from '@nestjs/common';
import { ToolContext, ToolDefinition } from './tool.interface';
import { WebSearchService } from './web-search/web-search.service';
import { wrapUntrusted } from '../ai/injection-guard';
import { registerWebSource } from '../ai/source-registry';

/**
 * `web_search` — read-only built-in tool. Searches the public web via the
 * configured provider (see `WebSearchService`) and returns numbered
 * `[Source N] <title> — <url>` blocks, mirroring the KB tool's `[Source N]`
 * text format so the model cites web results identically.
 *
 * Integration (plan TASK-09 option "a"): web search is a normal custom tool
 * backed by the generic search-API provider; one citation path for KB + web.
 *
 * Citation plumbing: web results are produced INSIDE the agentic loop, after the
 * KB sources were numbered into the system prompt. `ctx.sourceSink` is the
 * reply-wide citation list (KB sources first); each result is registered there
 * (`{ documentId: 'web:<n>', fileName: title, score: 1, url, type: 'web' }`,
 * deduped by URL) and printed with the number it got, so the `[Source N]`
 * markers line up with the `AI_STREAM_DONE.sources` chips.
 *
 * Untrusted content: web snippets are fenced with `wrapUntrusted` (spotlighting)
 * so a malicious page cannot inject instructions. Never throws — on
 * empty/failed search it returns a clear string and pushes nothing into the sink.
 */
@Injectable()
export class WebSearchTool {
  static readonly definition: ToolDefinition = {
    name: 'web_search',
    description:
      'Search the public web for current, real-time, or factual information not in the ' +
      "conversation's uploaded documents (news, recent events, prices, public facts, etc.). " +
      'Returns numbered [Source N] results with title, URL and snippet. Cite results as ' +
      '[Source N]. Use this when the user asks about something current or external that the ' +
      'knowledge base cannot answer.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The web search query' },
        maxResults: {
          type: 'number',
          description: 'Max results to return (default from config, typically 5)',
        },
      },
      required: ['query'],
    },
  };

  private readonly logger = new Logger(WebSearchTool.name);

  constructor(private readonly webSearch: WebSearchService) {}

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const query = ((input['query'] as string) ?? '').trim();
    if (!query) {
      return 'No results: an empty search query was provided.';
    }
    const requested = input['maxResults'] as number | undefined;
    const maxResults =
      typeof requested === 'number' && requested > 0
        ? Math.min(requested, 10)
        : this.webSearch.defaultMaxResults;

    let results;
    try {
      results = await this.webSearch.search(query, maxResults);
    } catch (err) {
      // Defensive: the provider already swallows errors, but never let a throw
      // escape the tool (it would dead-letter the AI request).
      this.logger.warn(`web_search failed for "${query}" (${(err as Error).message})`);
      return "I couldn't search the web right now. Please try again shortly.";
    }

    if (!results || results.length === 0) {
      return `No web results found for "${query}".`;
    }

    // Register each result in the reply-wide citation list and print the number
    // it gets, so `[Source N]` lines up with AI_STREAM_DONE.sources (KB sources
    // come first). Without a sink (no agentic loop) results number from 1.
    const body = results
      .map((r, i) => {
        const n = ctx.sourceSink
          ? registerWebSource(ctx.sourceSink, { title: r.title || r.url, url: r.url })
          : i + 1;
        const header = `[Source ${n}] ${r.title || r.url} — ${r.url}`;
        const snippet = (r.snippet ?? '').trim();
        return snippet ? `${header}\n${snippet}` : header;
      })
      .join('\n\n');

    return wrapUntrusted('Web Search Results', body);
  }
}
