import { ConfigService } from '@nestjs/config';
import { AiService, AiRequestPayload } from './ai.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { MemoryService } from '../memory/memory.service';
import { KbProcessorService } from '../kb/kb-processor.service';
import { EmbeddingService } from '../kb/embedding.service';
import { VectorStoreService } from '../kb/vector-store.service';
import { ToolRegistryService } from '../tools/tool-registry.service';

function makeAsyncIterator(chunks: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const c of chunks) yield c;
    },
  };
}

function makeChunks(texts: string[]) {
  return makeAsyncIterator(
    texts.map((t) => ({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: t },
    })),
  );
}

function makeErrorStream() {
  return {
    [Symbol.asyncIterator]: async function* () {
      throw new Error('model overloaded');
      // eslint-disable-next-line no-unreachable
      yield;
    },
  };
}

// Simulates a non-streaming response with no tool calls (end_turn)
function makeEndTurnResponse(textContent = '') {
  return {
    stop_reason: 'end_turn',
    content: textContent ? [{ type: 'text', text: textContent }] : [],
  };
}

// Simulates a non-streaming response requesting a tool call
function makeToolUseResponse(toolName: string, toolId: string, input: Record<string, unknown>) {
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
  };
}

describe('AiService', () => {
  let service: AiService;
  let publish: jest.Mock;
  let mockStream: jest.Mock;
  let mockCreate: jest.Mock;
  let getMemory: jest.Mock;
  let upsertMemory: jest.Mock;
  let deleteMemory: jest.Mock;
  let incrementMessageCount: jest.Mock;
  let getReadyDocumentIds: jest.Mock;
  let embedOne: jest.Mock;
  let vectorSearch: jest.Mock;
  let toolRegistryExecute: jest.Mock;
  let toolRegistryGetDefinitions: jest.Mock;

  const basePayload: AiRequestPayload = {
    conversationId: 'conv-test',
    userId: 'user-1',
    displayName: 'Alice',
    content: 'Hello AI',
    history: [],
  };

  beforeEach(() => {
    publish = jest.fn().mockResolvedValue(undefined);
    mockStream = jest.fn();
    mockCreate = jest.fn().mockResolvedValue(makeEndTurnResponse());
    getMemory = jest.fn().mockResolvedValue(null);
    upsertMemory = jest.fn().mockResolvedValue(undefined);
    deleteMemory = jest.fn().mockResolvedValue(undefined);
    incrementMessageCount = jest.fn().mockResolvedValue(1);
    getReadyDocumentIds = jest.fn().mockResolvedValue([]);
    embedOne = jest.fn().mockResolvedValue([0.1, 0.2]);
    vectorSearch = jest.fn().mockResolvedValue([]);
    toolRegistryExecute = jest.fn().mockResolvedValue('tool result');
    toolRegistryGetDefinitions = jest.fn().mockReturnValue([]);

    const fakeConfig = {
      get: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string | number> = {
          'config.anthropic.apiKey': 'test-key',
          'config.anthropic.model': 'test-primary',
          'config.anthropic.fallbackModel': 'test-fallback',
          'config.kb.qdrantCollection': 'knowledge',
          'config.kb.topK': 4,
        };
        return map[key];
      }),
    } as unknown as ConfigService;

    const fakePublisher = { publish } as unknown as RedisPublisherService;
    const fakeMemory = {
      getMemory, upsertMemory, deleteMemory, incrementMessageCount,
    } as unknown as MemoryService;
    const fakeKbProcessor = { getReadyDocumentIds } as unknown as KbProcessorService;
    const fakeEmbedding = { embedOne } as unknown as EmbeddingService;
    const fakeVectorStore = { search: vectorSearch } as unknown as VectorStoreService;
    const fakeToolRegistry = {
      getDefinitions: toolRegistryGetDefinitions,
      execute: toolRegistryExecute,
    } as unknown as ToolRegistryService;

    service = new AiService(
      fakeConfig, fakePublisher, fakeMemory, fakeKbProcessor, fakeEmbedding,
      fakeVectorStore, fakeToolRegistry,
    );
    (service as any)['anthropic'] = { messages: { stream: mockStream, create: mockCreate } };
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Basic streaming ──────────────────────────────────────────────────────

  it('publishes AI_STREAM_CHUNK for each delta then AI_STREAM_DONE', async () => {
    mockCreate.mockResolvedValue(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['Hello', ' World']));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_CHUNK',
      chunk: 'Hello',
    });
    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_CHUNK',
      chunk: ' World',
    });
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      fullContent: 'Hello World',
      sources: [],
      toolTrace: [],
    }));
  });

  it('retries fallback model when primary fails before any chunks', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('model overloaded'))
      .mockResolvedValueOnce(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['Fallback reply']));

    await service.handleRequest(basePayload);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      fullContent: 'Fallback reply',
    }));
    expect(publish).not.toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_ERROR' }),
    );
  });

  it('publishes AI_STREAM_ERROR when both primary and fallback fail', async () => {
    mockCreate.mockRejectedValue(new Error('model overloaded'));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_ERROR',
      error: 'AI is temporarily unavailable.',
    });
  });

  // ─── Memory injection ─────────────────────────────────────────────────────

  it('injects memory into system prompt when memory exists', async () => {
    getMemory.mockResolvedValue({
      conversationId: 'conv-test',
      summary: 'User discussed Flutter and Redis',
      keyFacts: ['Uses Flutter', 'Uses Redis'],
      messageCount: 20,
    });
    mockCreate.mockResolvedValue(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.system).toContain('Memory from previous conversations');
    expect(createCall.system).toContain('User discussed Flutter and Redis');
    expect(createCall.system).toContain('- Uses Flutter');
    expect(createCall.system).toContain('- Uses Redis');
  });

  it('does not inject memory when none exists', async () => {
    getMemory.mockResolvedValue(null);
    mockCreate.mockResolvedValue(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.system).not.toContain('Memory from previous conversations');
  });

  // ─── Auto-summarization ───────────────────────────────────────────────────

  it('triggers _generateSummary at messageCount divisible by 20', async () => {
    const payloadWithHistory: AiRequestPayload = {
      ...basePayload,
      history: [{ role: 'user', content: 'What is Flutter?' }],
    };
    incrementMessageCount.mockResolvedValue(20);
    mockCreate
      .mockResolvedValueOnce(makeEndTurnResponse())
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'User discussed AI.\nFACTS: ["Uses AI"]' }],
      });
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(payloadWithHistory);
    await new Promise((r) => setTimeout(r, 50));

    expect(upsertMemory).toHaveBeenCalledWith(
      'conv-test', 'user-1', 'User discussed AI.', ['Uses AI'], 20,
    );
  });

  it('does not trigger _generateSummary when count is not divisible by 20', async () => {
    incrementMessageCount.mockResolvedValue(5);
    mockCreate.mockResolvedValue(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);
    await new Promise((r) => setTimeout(r, 50));

    expect(upsertMemory).not.toHaveBeenCalled();
  });

  it('triggers summarization at count 40 (multiple of 20)', async () => {
    const payloadWithHistory: AiRequestPayload = {
      ...basePayload,
      history: [{ role: 'user', content: 'Hello' }],
    };
    incrementMessageCount.mockResolvedValue(40);
    mockCreate
      .mockResolvedValueOnce(makeEndTurnResponse())
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Summary at 40.\nFACTS: ["fact1"]' }],
      });
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(payloadWithHistory);
    await new Promise((r) => setTimeout(r, 50));

    expect(upsertMemory).toHaveBeenCalledWith('conv-test', 'user-1', 'Summary at 40.', ['fact1'], 40);
  });

  // ─── RAG context injection ────────────────────────────────────────────────

  it('injects RAG context into system prompt when docs exist with high score', async () => {
    getReadyDocumentIds.mockResolvedValue(['doc1']);
    vectorSearch.mockResolvedValue([
      { text: 'Flutter is a UI toolkit.', documentId: 'doc1', score: 0.85 },
      { text: 'Dart is the language.', documentId: 'doc1', score: 0.75 },
    ]);
    mockCreate.mockResolvedValue(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['Based on [Source 1]...']));

    await service.handleRequest(basePayload);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.system).toContain('[Source 1] Flutter is a UI toolkit.');
    expect(createCall.system).toContain('[Source 2] Dart is the language.');
    expect(createCall.system).toContain('Relevant Knowledge Base Context');
  });

  it('includes sources in AI_STREAM_DONE payload', async () => {
    getReadyDocumentIds.mockResolvedValue(['doc1']);
    vectorSearch.mockResolvedValue([
      { text: 'Some content', documentId: 'doc1', score: 0.8 },
    ]);
    mockCreate.mockResolvedValue(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      sources: [{ documentId: 'doc1', score: 0.8 }],
    }));
  });

  it('does not inject RAG context when all scores below 0.3 threshold', async () => {
    getReadyDocumentIds.mockResolvedValue(['doc1']);
    vectorSearch.mockResolvedValue([
      { text: 'Irrelevant content', documentId: 'doc1', score: 0.1 },
    ]);
    mockCreate.mockResolvedValue(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.system).not.toContain('Relevant Knowledge Base Context');
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      sources: [],
    }));
  });

  it('proceeds without RAG when no docs in conversation', async () => {
    getReadyDocumentIds.mockResolvedValue([]);
    mockCreate.mockResolvedValue(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    expect(embedOne).not.toHaveBeenCalled();
    expect(vectorSearch).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      sources: [],
    }));
  });

  it('degrades gracefully when Qdrant throws error', async () => {
    getReadyDocumentIds.mockResolvedValue(['doc1']);
    embedOne.mockRejectedValue(new Error('Qdrant unavailable'));
    mockCreate.mockResolvedValue(makeEndTurnResponse());
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      sources: [],
    }));
  });

  // ─── Agentic loop (AI-4.5) ────────────────────────────────────────────────

  it('executes single tool call then publishes final stream', async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('search_messages', 'tool-1', { query: 'Flutter' }))
      .mockResolvedValueOnce(makeEndTurnResponse());
    toolRegistryExecute.mockResolvedValue('Found: Flutter is great');
    mockStream.mockReturnValue(makeChunks(['Based on search: Flutter is great']));

    await service.handleRequest(basePayload);

    expect(toolRegistryExecute).toHaveBeenCalledWith(
      'search_messages', { query: 'Flutter' }, expect.objectContaining({ conversationId: 'conv-test' }),
    );
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_TOOL_CALL',
      toolName: 'search_messages',
    }));
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      toolTrace: expect.arrayContaining([
        expect.objectContaining({ toolName: 'search_messages' }),
      ]),
    }));
  });

  it('executes two consecutive tool calls then final stream', async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('get_user_info', 'tool-1', {}))
      .mockResolvedValueOnce(makeToolUseResponse('search_messages', 'tool-2', { query: 'test' }))
      .mockResolvedValueOnce(makeEndTurnResponse());
    toolRegistryExecute.mockResolvedValue('result');
    mockStream.mockReturnValue(makeChunks(['Final answer']));

    await service.handleRequest(basePayload);

    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(toolRegistryExecute).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      toolTrace: expect.arrayContaining([
        expect.objectContaining({ toolName: 'get_user_info' }),
        expect.objectContaining({ toolName: 'search_messages' }),
      ]),
    }));
  });

  it('publishes fallback message when MAX_ITER exhausted', async () => {
    // Always returns tool_use — never end_turn
    mockCreate.mockResolvedValue(makeToolUseResponse('search_messages', 'tool-x', { query: 'x' }));
    toolRegistryExecute.mockResolvedValue('some result');
    // stream should not be called in this case
    mockStream.mockReturnValue(makeChunks(['Should not be called']));

    await service.handleRequest(basePayload);

    // MAX_ITER = 5, so create is called 5 times
    expect(mockCreate).toHaveBeenCalledTimes(5);
    // Should publish AI_STREAM_DONE with fallback text
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
    }));
    // Stream should NOT be called since MAX_ITER was reached
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('tool executor error returns error string and loop continues', async () => {
    mockCreate
      .mockResolvedValueOnce(makeToolUseResponse('search_messages', 'tool-1', { query: 'x' }))
      .mockResolvedValueOnce(makeEndTurnResponse());
    toolRegistryExecute.mockResolvedValue('Tool error: database unavailable');
    mockStream.mockReturnValue(makeChunks(['I encountered an issue']));

    await service.handleRequest(basePayload);

    // Loop continues after error string (doesn't throw)
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
    }));
  });
});
