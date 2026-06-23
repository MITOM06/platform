import { Injectable, Logger } from '@nestjs/common';
import { ToolContext, ToolDefinition } from './tool.interface';
import { WebSearchService } from './web-search/web-search.service';
import { wrapUntrusted } from '../ai/injection-guard';

/**
 * `web_search` — read-only built-in tool. Searches the public web via the
 * configured provider (see `WebSearchService`) and returns numbered
 * `[Source N] <title> — <url>` blocks, mirroring the KB tool's `[Source N]`
 * text format so the model cites web results identically.
 *
 * Integration (plan TASK-09 option "a"): web search is a normal custom tool
 * backed by the generic search-API provider; one citation path for KB + web.
 *
 * Citation plumbing: web results are produced INSIDE the agentic loop, AFTER
 * `ctx.ragSources` was built. So the tool ALSO pushes one `RagSource` per result
 * into `ctx.sourceSink` (`{ documentId: 'web:'+i, fileName: title, score, url,
 * type:'web' }`). `_agenticLoop` merges the sink with `ctx.ragSources`
 * (RAG first, web after, contiguous) into the `AI_STREAM_DONE` `sources` array,
 * so the `[Source N]` markers the model emits line up with the rendered chips.
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

    // Push one source per result into the loop's sink so it reaches AI_STREAM_DONE.
    // Distinct synthetic `web:<i>` ids survive client dedup-by-documentId.
    results.forEach((r, i) => {
      ctx.sourceSink?.push({
        documentId: `web:${i}`,
        fileName: r.title || r.url,
        score: 1,
        url: r.url,
        type: 'web',
      });
    });

    // Format [Source N] blocks; fence the untrusted snippet text (spotlighting).
    const body = results
      .map((r, i) => {
        const header = `[Source ${i + 1}] ${r.title || r.url} — ${r.url}`;
        const snippet = (r.snippet ?? '').trim();
        return snippet ? `${header}\n${snippet}` : header;
      })
      .join('\n\n');

    return wrapUntrusted('Web Search Results', body);
  }
}
