import { ConfigService } from '@nestjs/config';
import { AiService, AiRequestPayload } from './ai.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { MemoryService } from '../memory/memory.service';
import { KbProcessorService } from '../kb/kb-processor.service';
import { EmbeddingService } from '../kb/embedding.service';
import { VectorStoreService } from '../kb/vector-store.service';

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
    mockCreate = jest.fn();
    getMemory = jest.fn().mockResolvedValue(null);
    upsertMemory = jest.fn().mockResolvedValue(undefined);
    deleteMemory = jest.fn().mockResolvedValue(undefined);
    incrementMessageCount = jest.fn().mockResolvedValue(1);
    getReadyDocumentIds = jest.fn().mockResolvedValue([]);
    embedOne = jest.fn().mockResolvedValue([0.1, 0.2]);
    vectorSearch = jest.fn().mockResolvedValue([]);

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

    service = new AiService(
      fakeConfig, fakePublisher, fakeMemory, fakeKbProcessor, fakeEmbedding, fakeVectorStore,
    );
    (service as any)['anthropic'] = { messages: { stream: mockStream, create: mockCreate } };
  });

  afterEach(() => jest.clearAllMocks());

  it('publishes AI_STREAM_CHUNK for each delta then AI_STREAM_DONE', async () => {
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
    }));
    expect(publish).not.toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_ERROR' }),
    );
  });

  it('retries fallback model when primary fails before any chunks', async () => {
    mockStream
      .mockReturnValueOnce(makeErrorStream())
      .mockReturnValueOnce(makeChunks(['Fallback reply']));

    await service.handleRequest(basePayload);

    expect(mockStream).toHaveBeenCalledTimes(2);
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
    mockStream.mockReturnValue(makeErrorStream());

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_ERROR',
      error: 'AI is temporarily unavailable.',
    });
  });

  // AI-2.4: Memory injection into system prompt
  it('injects memory into system prompt when memory exists', async () => {
    getMemory.mockResolvedValue({
      conversationId: 'conv-test',
      summary: 'User discussed Flutter and Redis',
      keyFacts: ['Uses Flutter', 'Uses Redis'],
      messageCount: 20,
    });
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    const streamCall = mockStream.mock.calls[0][0];
    expect(streamCall.system).toContain('Memory from previous conversations');
    expect(streamCall.system).toContain('User discussed Flutter and Redis');
    expect(streamCall.system).toContain('- Uses Flutter');
    expect(streamCall.system).toContain('- Uses Redis');
  });

  it('does not inject memory when none exists', async () => {
    getMemory.mockResolvedValue(null);
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    const streamCall = mockStream.mock.calls[0][0];
    expect(streamCall.system).not.toContain('Memory from previous conversations');
  });

  // AI-2.3: Auto-summarization trigger at multiples of 20
  it('triggers _generateSummary at messageCount divisible by 20', async () => {
    const payloadWithHistory: AiRequestPayload = {
      ...basePayload,
      history: [{ role: 'user', content: 'What is Flutter?' }],
    };
    incrementMessageCount.mockResolvedValue(20);
    mockStream.mockReturnValue(makeChunks(['OK']));
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'User discussed AI.\nFACTS: ["Uses AI"]' }],
    });

    await service.handleRequest(payloadWithHistory);
    await new Promise((r) => setTimeout(r, 50));

    expect(upsertMemory).toHaveBeenCalledWith(
      'conv-test', 'user-1', 'User discussed AI.', ['Uses AI'], 20,
    );
  });

  it('does not trigger _generateSummary when count is not divisible by 20', async () => {
    incrementMessageCount.mockResolvedValue(5);
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
    mockStream.mockReturnValue(makeChunks(['OK']));
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Summary at 40.\nFACTS: ["fact1"]' }],
    });

    await service.handleRequest(payloadWithHistory);
    await new Promise((r) => setTimeout(r, 50));

    expect(upsertMemory).toHaveBeenCalledWith('conv-test', 'user-1', 'Summary at 40.', ['fact1'], 40);
  });

  // AI-3.6: RAG context injection
  it('injects RAG context into system prompt when docs exist with high score', async () => {
    getReadyDocumentIds.mockResolvedValue(['doc1']);
    vectorSearch.mockResolvedValue([
      { text: 'Flutter is a UI toolkit.', documentId: 'doc1', score: 0.85 },
      { text: 'Dart is the language.', documentId: 'doc1', score: 0.75 },
    ]);
    mockStream.mockReturnValue(makeChunks(['Based on [Source 1]...']));

    await service.handleRequest(basePayload);

    const streamCall = mockStream.mock.calls[0][0];
    expect(streamCall.system).toContain('[Source 1] Flutter is a UI toolkit.');
    expect(streamCall.system).toContain('[Source 2] Dart is the language.');
    expect(streamCall.system).toContain('Relevant Knowledge Base Context');
  });

  it('includes sources in AI_STREAM_DONE payload', async () => {
    getReadyDocumentIds.mockResolvedValue(['doc1']);
    vectorSearch.mockResolvedValue([
      { text: 'Some content', documentId: 'doc1', score: 0.8 },
    ]);
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
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    const streamCall = mockStream.mock.calls[0][0];
    expect(streamCall.system).not.toContain('Relevant Knowledge Base Context');
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      sources: [],
    }));
  });

  it('proceeds without RAG when no docs in conversation', async () => {
    getReadyDocumentIds.mockResolvedValue([]);
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
    mockStream.mockReturnValue(makeChunks(['OK']));

    await service.handleRequest(basePayload);

    // Should still complete without error, just no RAG
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      sources: [],
    }));
  });
});
