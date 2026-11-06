import { SearchKnowledgeBaseTool } from './search-knowledge-base.tool';
import { RagSource } from '../ai/rag-source.type';
import { ToolContext } from './tool.interface';

/**
 * The KB tool is the model's on-demand RAG path. Its scope MUST come from the
 * request context (conversation / department), never from the model's input —
 * otherwise a prompt-injected query could read another conversation's documents.
 */
function make(opts: {
  docIds?: string[];
  hits?: Array<{ text: string; documentId: string; score: number }>;
  fileNames?: Map<string, string>;
  config?: Record<string, unknown>;
} = {}) {
  const kbProcessor = {
    getReadyDocumentIds: jest.fn().mockResolvedValue(opts.docIds ?? ['d1']),
    getFileNames: jest.fn().mockResolvedValue(opts.fileNames ?? new Map()),
  };
  const embedding = { embedOne: jest.fn().mockResolvedValue([0.1, 0.2]) };
  const vectorStore = { search: jest.fn().mockResolvedValue(opts.hits ?? []) };
  const config = { get: jest.fn((k: string) => opts.config?.[k]) };
  const tool = new SearchKnowledgeBaseTool(
    embedding as never,
    vectorStore as never,
    kbProcessor as never,
    config as never,
  );
  return { tool, kbProcessor, embedding, vectorStore };
}

const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({
  conversationId: 'conv-1',
  userId: 'u1',
  displayName: 'An',
  ...over,
});

describe('SearchKnowledgeBaseTool', () => {
  it('scopes retrieval to the request conversation, ignoring any scope the model passes', async () => {
    const { tool, kbProcessor, vectorStore } = make({ docIds: ['d1', 'd2'] });

    await tool.execute(
      { query: 'q', conversationId: 'other-conv', departmentId: 'other-dept' },
      ctx(),
    );

    expect(kbProcessor.getReadyDocumentIds).toHaveBeenCalledWith('conv-1', undefined);
    expect(vectorStore.search).toHaveBeenCalledWith('knowledge', [0.1, 0.2], 8, ['d1', 'd2']);
  });

  it('scopes to the department KB in a department group chat', async () => {
    const { tool, kbProcessor } = make();
    await tool.execute({ query: 'q' }, ctx({ departmentId: 'dept-9' }));
    expect(kbProcessor.getReadyDocumentIds).toHaveBeenCalledWith('conv-1', 'dept-9');
  });

  it('never searches the vector store (unfiltered) when the scope has no ready documents', async () => {
    const { tool, embedding, vectorStore } = make({ docIds: [] });

    const out = await tool.execute({ query: 'q' }, ctx());

    expect(out).toBe(
      'No relevant context: this conversation has no processed knowledge-base documents.',
    );
    expect(embedding.embedOne).not.toHaveBeenCalled();
    expect(vectorStore.search).not.toHaveBeenCalled();
  });

  it('drops hits under the score threshold and reports no relevant context when none clear it', async () => {
    const { tool } = make({ hits: [{ text: 'weak', documentId: 'd1', score: 0.19 }] });
    const out = await tool.execute({ query: 'q' }, ctx());
    expect(out).toBe(
      'No relevant context: no document chunk cleared the confidence threshold for this query.',
    );
  });

  it('sorts by score, keeps topK and numbers from 1 without a source sink', async () => {
    const { tool, vectorStore, kbProcessor } = make({
      hits: [
        { text: 'mid', documentId: 'd1', score: 0.5 },
        { text: 'best', documentId: 'd2', score: 0.9 },
        { text: 'low', documentId: 'd3', score: 0.3 },
      ],
    });

    const out = await tool.execute({ query: 'q', topK: 2 }, ctx());

    expect(out).toBe('[Source 1] (score 0.90) best\n\n[Source 2] (score 0.50) mid');
    // Over-fetch never drops below topK.
    expect(vectorStore.search.mock.calls[0][2]).toBe(8);
    expect(kbProcessor.getFileNames).not.toHaveBeenCalled();
  });

  it('over-fetches topK when the model asks for more than the over-fetch size', async () => {
    const { tool, vectorStore } = make({ config: { 'config.kb.overFetch': 3 } });
    await tool.execute({ query: 'q', topK: 10 }, ctx());
    expect(vectorStore.search.mock.calls[0][2]).toBe(10);
  });

  it('registers hits in the reply-wide sink so [Source N] matches the citation list', async () => {
    const sink: RagSource[] = [{ documentId: 'd-prompt', fileName: 'a.pdf', score: 0.8 }];
    const { tool } = make({
      hits: [
        { text: 'x', documentId: 'd-prompt', score: 0.7 },
        { text: 'y', documentId: 'd-new', score: 0.6 },
      ],
      fileNames: new Map([['d-new', 'new.docx']]),
    });

    const out = await tool.execute({ query: 'q' }, ctx({ sourceSink: sink }));

    expect(out).toBe('[Source 1] (score 0.70) x\n\n[Source 2] (score 0.60) y');
    expect(sink).toEqual([
      { documentId: 'd-prompt', fileName: 'a.pdf', score: 0.8 },
      { documentId: 'd-new', fileName: 'new.docx', score: 0.6 },
    ]);
  });

  it('uses the configured collection, topK and threshold', async () => {
    const { tool, vectorStore } = make({
      config: {
        'config.kb.qdrantCollection': 'kb2',
        'config.kb.topK': 1,
        'config.kb.scoreThreshold': 0.8,
      },
      hits: [
        { text: 'a', documentId: 'd1', score: 0.85 },
        { text: 'b', documentId: 'd2', score: 0.95 },
        { text: 'c', documentId: 'd3', score: 0.5 },
      ],
    });

    const out = await tool.execute({ query: 'q' }, ctx());

    expect(vectorStore.search.mock.calls[0][0]).toBe('kb2');
    expect(out).toBe('[Source 1] (score 0.95) b');
  });
});
