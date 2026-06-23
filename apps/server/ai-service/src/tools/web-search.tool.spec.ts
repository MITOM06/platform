import { WebSearchTool } from './web-search.tool';
import { WebSearchService } from './web-search/web-search.service';
import { ToolContext } from './tool.interface';
import { RagSource } from '../ai/rag-source.type';
import { WebSearchResult } from './web-search/web-search-provider.interface';

function makeCtx(): ToolContext & { sourceSink: RagSource[] } {
  return {
    conversationId: 'c1',
    userId: 'u1',
    displayName: 'Tester',
    sourceSink: [],
  };
}

function makeService(over: Partial<WebSearchService> = {}): WebSearchService {
  return {
    isAvailable: () => true,
    defaultMaxResults: 5,
    search: jest.fn(),
    ...over,
  } as unknown as WebSearchService;
}

describe('WebSearchTool', () => {
  it('has a static read-only definition named web_search', () => {
    expect(WebSearchTool.definition.name).toBe('web_search');
    expect(WebSearchTool.definition.input_schema.required).toContain('query');
  });

  it('formats [Source N] blocks and pushes matching RagSource entries into the sink', async () => {
    const results: WebSearchResult[] = [
      { title: 'Result One', url: 'https://a.example/1', snippet: 'snippet one' },
      { title: 'Result Two', url: 'https://b.example/2', snippet: 'snippet two' },
    ];
    const service = makeService({ search: jest.fn().mockResolvedValue(results) });
    const tool = new WebSearchTool(service);
    const ctx = makeCtx();

    const out = await tool.execute({ query: 'hello world' }, ctx);

    // Text mirrors the KB [Source N] format and includes title + url + snippet.
    expect(out).toContain('[Source 1] Result One — https://a.example/1');
    expect(out).toContain('snippet one');
    expect(out).toContain('[Source 2] Result Two — https://b.example/2');

    // One source per result, with synthetic web:N ids, title as fileName,
    // url present, type 'web'.
    expect(ctx.sourceSink).toEqual([
      { documentId: 'web:0', fileName: 'Result One', score: 1, url: 'https://a.example/1', type: 'web' },
      { documentId: 'web:1', fileName: 'Result Two', score: 1, url: 'https://b.example/2', type: 'web' },
    ]);
  });

  it('returns a clear "no results" string and an empty sink when the provider returns []', async () => {
    const service = makeService({ search: jest.fn().mockResolvedValue([]) });
    const tool = new WebSearchTool(service);
    const ctx = makeCtx();

    const out = await tool.execute({ query: 'nothing here' }, ctx);

    expect(out).toContain('No web results found');
    expect(ctx.sourceSink).toHaveLength(0);
  });

  it('returns an empty-query message without calling the provider', async () => {
    const search = jest.fn();
    const tool = new WebSearchTool(makeService({ search }));
    const ctx = makeCtx();

    const out = await tool.execute({ query: '   ' }, ctx);

    expect(out).toContain('No results');
    expect(search).not.toHaveBeenCalled();
    expect(ctx.sourceSink).toHaveLength(0);
  });

  it('swallows a provider error (never throws) and returns a friendly string', async () => {
    const service = makeService({
      search: jest.fn().mockRejectedValue(new Error('boom')),
    });
    const tool = new WebSearchTool(service);
    const ctx = makeCtx();

    const out = await tool.execute({ query: 'boom query' }, ctx);

    expect(out).toContain("couldn't search the web");
    expect(ctx.sourceSink).toHaveLength(0);
  });

  it('caps maxResults at 10 when a larger value is requested', async () => {
    const search = jest.fn().mockResolvedValue([]);
    const tool = new WebSearchTool(makeService({ search }));
    await tool.execute({ query: 'q', maxResults: 50 }, makeCtx());
    expect(search).toHaveBeenCalledWith('q', 10);
  });

  it('falls back to the configured default maxResults when none is given', async () => {
    const search = jest.fn().mockResolvedValue([]);
    const tool = new WebSearchTool(makeService({ search, defaultMaxResults: 7 }));
    await tool.execute({ query: 'q' }, makeCtx());
    expect(search).toHaveBeenCalledWith('q', 7);
  });
});
