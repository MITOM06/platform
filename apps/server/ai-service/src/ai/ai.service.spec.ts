import { ConfigService } from '@nestjs/config';
import { AiService, AiRequestPayload } from './ai.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { MemoryService } from '../memory/memory.service';
import { EmbeddingService } from '../kb/embedding.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { UsageService } from '../usage/usage.service';
import { RateLimiterService } from '../usage/rate-limiter.service';
import { PersonaService } from '../persona/persona.service';
import { FactExtractorService } from './fact-extractor.service';
import { ContextBuilderService } from './context-builder.service';
import { ResponseCacheService } from './response-cache.service';
import { SkillsService } from '../skills/skills.service';

function makeAsyncIterator(chunks: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const c of chunks) yield c;
    },
  };
}

/**
 * Build a streaming response that emits text deltas, then finalMessage()
 * resolves with the given stop_reason / content / usage. This is the single
 * code path now — the loop, tool turns, and the final answer all stream.
 */
function makeStream(
  texts: string[],
  finalMessage: {
    stop_reason?: string;
    content?: unknown[];
    usage?: { input_tokens: number; output_tokens: number };
  } = {},
) {
  const events = texts.map((t) => ({
    type: 'content_block_delta',
    delta: { type: 'text_delta', text: t },
  }));
  return {
    ...makeAsyncIterator(events),
    finalMessage: jest.fn().mockResolvedValue({
      stop_reason: finalMessage.stop_reason ?? 'end_turn',
      content: finalMessage.content ?? texts.map((t) => ({ type: 'text', text: t })),
      usage: finalMessage.usage ?? { input_tokens: 10, output_tokens: 20 },
    }),
  };
}

function makeToolUseStream(toolName: string, toolId: string, input: Record<string, unknown>) {
  return {
    ...makeAsyncIterator([]),
    finalMessage: jest.fn().mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
      usage: { input_tokens: 8, output_tokens: 12 },
    }),
  };
}

function makeThinkingStream(thinkingText: string, responseText: string) {
  const events = [
    { type: 'content_block_start', content_block: { type: 'thinking' } },
    { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: thinkingText } },
    { type: 'content_block_stop' },
    { type: 'content_block_start', content_block: { type: 'text' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: responseText } },
    { type: 'content_block_stop' },
  ];
  return {
    ...makeAsyncIterator(events),
    finalMessage: jest.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: responseText }],
      usage: { input_tokens: 50, output_tokens: 80 },
    }),
  };
}

const SAMPLE_TOOLS = [
  {
    name: 'search_messages',
    description: 'd',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_user_info',
    description: 'd',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

describe('AiService', () => {
  let service: AiService;
  let publish: jest.Mock;
  let mockStream: jest.Mock;
  let mockCreate: jest.Mock;
  let incrementMessageCount: jest.Mock;
  let embedOne: jest.Mock;
  let toolRegistryExecute: jest.Mock;
  let toolRegistryGetDefinitions: jest.Mock;
  let recordUsage: jest.Mock;
  let isQuotaExceeded: jest.Mock;
  let acquire: jest.Mock;
  let release: jest.Mock;
  let getPersona: jest.Mock;
  let buildSystemPromptFn: jest.Mock;
  let extractFacts: jest.Mock;
  let buildVolatileContext: jest.Mock;

  const basePayload: AiRequestPayload = {
    conversationId: 'conv-test',
    userId: 'user-1',
    displayName: 'Alice',
    content: 'Hello AI',
    history: [],
  };

  function systemText(call: { system: Array<{ text: string }> | string }): string {
    if (typeof call.system === 'string') return call.system;
    return call.system.map((b) => b.text).join('\n');
  }

  beforeEach(() => {
    publish = jest.fn().mockResolvedValue(undefined);
    mockStream = jest.fn().mockReturnValue(makeStream(['OK']));
    mockCreate = jest.fn().mockResolvedValue({ content: [] });
    incrementMessageCount = jest.fn().mockResolvedValue(1);
    embedOne = jest.fn().mockResolvedValue([0.1, 0.2]);
    toolRegistryExecute = jest.fn().mockResolvedValue('tool result');
    toolRegistryGetDefinitions = jest.fn().mockReturnValue([]);
    recordUsage = jest.fn().mockResolvedValue(undefined);
    isQuotaExceeded = jest.fn().mockResolvedValue(false);
    release = jest.fn().mockResolvedValue(undefined);
    acquire = jest.fn().mockResolvedValue({ allowed: true, release });
    getPersona = jest.fn().mockResolvedValue(null);
    buildSystemPromptFn = jest.fn().mockReturnValue('You are PON AI...');
    extractFacts = jest.fn().mockResolvedValue(undefined);
    buildVolatileContext = jest.fn().mockResolvedValue({ text: '', ragSources: [] });

    const fakeConfig = {
      get: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string | number | boolean> = {
          'config.anthropic.apiKey': 'test-key',
          'config.anthropic.model': 'test-primary',
          'config.anthropic.fallbackModel': 'test-fallback',
          'config.anthropic.effort': 'high',
          'config.memory.extractEveryTurns': 20,
          'config.ai.enableThinking': false,
          'config.quota.monthlyTokenLimit': 500000,
          'config.anthropic.router.enabled': false,
          'config.anthropic.router.simpleModel': 'claude-haiku-4-5',
          'config.anthropic.router.midModel': 'claude-sonnet-4-6',
          'config.anthropic.router.complexModel': 'test-primary',
          'config.anthropic.router.simpleMaxChars': 280,
          'config.anthropic.router.simpleMaxHistory': 4,
          'config.anthropic.router.midMaxChars': 1200,
          'config.anthropic.router.midMaxHistory': 20,
        };
        return map[key];
      }),
    } as unknown as ConfigService;

    const fakePublisher = { publish } as unknown as RedisPublisherService;
    const fakeMemory = { incrementMessageCount } as unknown as MemoryService;
    const fakeEmbedding = { embedOne } as unknown as EmbeddingService;
    const fakeToolRegistry = {
      getDefinitions: toolRegistryGetDefinitions,
      execute: toolRegistryExecute,
    } as unknown as ToolRegistryService;
    const fakeUsage = { recordUsage, isQuotaExceeded } as unknown as UsageService;
    const fakeRateLimiter = { acquire } as unknown as RateLimiterService;
    const fakePersona = {
      getPersona,
      buildSystemPrompt: buildSystemPromptFn,
    } as unknown as PersonaService;
    const fakeFactExtractor = { extractFacts } as unknown as FactExtractorService;
    const fakeContextBuilder = {
      buildVolatileContext,
    } as unknown as ContextBuilderService;
    const fakeSkills = {
      getEnabledSkillInstructions: jest.fn().mockResolvedValue(''),
    } as unknown as SkillsService;
    const fakeResponseCache = {
      isEnabled: false,
      lookup: jest.fn().mockResolvedValue(null),
      store: jest.fn().mockResolvedValue(undefined),
    } as unknown as ResponseCacheService;

    service = new AiService(
      fakeConfig,
      fakePublisher,
      fakeMemory,
      fakeEmbedding,
      fakeToolRegistry,
      fakeUsage,
      fakeRateLimiter,
      fakePersona,
      fakeFactExtractor,
      fakeContextBuilder,
      fakeSkills,
      fakeResponseCache,
    );
    (service as any)['anthropic'] = { messages: { stream: mockStream, create: mockCreate } };
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Basic streaming ──────────────────────────────────────────────────────

  it('publishes AI_STREAM_CHUNK for each delta then AI_STREAM_DONE', async () => {
    mockStream.mockReturnValue(makeStream(['Hello', ' World']));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', { type: 'AI_STREAM_CHUNK', chunk: 'Hello' });
    expect(publish).toHaveBeenCalledWith('conv-test', { type: 'AI_STREAM_CHUNK', chunk: ' World' });
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      fullContent: 'Hello World',
      sources: [],
      trace: expect.objectContaining({ toolCalls: [] }),
    }));
  });

  it('uses a single streaming call for a plain answer (no second blind call)', async () => {
    mockStream.mockReturnValue(makeStream(['Answer']));

    await service.handleRequest(basePayload);

    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('sends tools and effort/output_config and a cached system block', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const params = mockStream.mock.calls[0][0];
    expect(params.output_config).toEqual({ effort: 'high' });
    expect(Array.isArray(params.system)).toBe(true);
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral' });
    // last tool carries a cache breakpoint
    expect(params.tools[params.tools.length - 1].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('retries fallback model when primary fails before any chunks', async () => {
    mockStream
      .mockImplementationOnce(() => {
        throw new Error('model overloaded');
      })
      .mockReturnValueOnce(makeStream(['Fallback reply']));

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

  it('publishes AI_STREAM_ERROR and rethrows when both models fail', async () => {
    mockStream.mockImplementation(() => {
      throw new Error('model overloaded');
    });

    await expect(service.handleRequest(basePayload)).rejects.toThrow();

    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_ERROR',
      code: 'AI_UNAVAILABLE',
      error: 'AI is temporarily unavailable.',
    });
  });

  // ─── Memory injection (delegated to ContextBuilderService) ────────────────

  it('injects retrieved memory facts as a volatile system block', async () => {
    buildVolatileContext.mockResolvedValue({
      text:
        '## Relevant memory about this user (stored facts — treat as remembered, not inferred):\n- Uses Flutter\n- Uses Redis',
      ragSources: [],
    });
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const sys = systemText(mockStream.mock.calls[0][0]);
    expect(sys).toContain('Relevant memory about this user');
    expect(sys).toContain('- Uses Flutter');
    expect(sys).toContain('- Uses Redis');
  });

  it('does not inject memory block when no relevant facts', async () => {
    buildVolatileContext.mockResolvedValue({ text: '', ragSources: [] });
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const sys = systemText(mockStream.mock.calls[0][0]);
    expect(sys).not.toContain('Relevant memory about this user');
  });

  it('keeps the persona prompt in a cached block separate from volatile context', async () => {
    buildSystemPromptFn.mockReturnValue('PERSONA-STABLE');
    buildVolatileContext.mockResolvedValue({ text: 'fact block content', ragSources: [] });
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const params = mockStream.mock.calls[0][0];
    expect(params.system[0].text).toBe('PERSONA-STABLE');
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral' });
    // volatile block has NO cache_control
    expect(params.system[1].cache_control).toBeUndefined();
    expect(params.system[1].text).toContain('fact');
  });

  // ─── Fact extraction ──────────────────────────────────────────────────────

  it('triggers fact extraction at messageCount divisible by 20', async () => {
    const payloadWithHistory: AiRequestPayload = {
      ...basePayload,
      history: [{ role: 'user', content: 'What is Flutter?' }],
    };
    incrementMessageCount.mockResolvedValue(20);
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(payloadWithHistory);
    await new Promise((r) => setTimeout(r, 50));

    expect(extractFacts).toHaveBeenCalledWith(
      'conv-test',
      'user-1',
      payloadWithHistory.history,
      20,
    );
  });

  it('does not extract facts when count is not divisible by 20', async () => {
    incrementMessageCount.mockResolvedValue(5);
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);
    await new Promise((r) => setTimeout(r, 50));

    expect(extractFacts).not.toHaveBeenCalled();
  });

  // ─── RAG context injection (delegated to ContextBuilderService) ───────────

  it('injects RAG context when docs exist with high score', async () => {
    buildVolatileContext.mockResolvedValue({
      text:
        '## Knowledge Base Context:\n[Source 1] Flutter is a UI toolkit.\n\n[Source 2] Dart is the language.\n\nUse ONLY this context',
      ragSources: [
        { documentId: 'doc1', fileName: 'flutter.pdf', score: 0.85 },
        { documentId: 'doc1', fileName: 'flutter.pdf', score: 0.75 },
      ],
    });
    mockStream.mockReturnValue(makeStream(['Based on [Source 1]...']));

    await service.handleRequest(basePayload);

    const sys = systemText(mockStream.mock.calls[0][0]);
    expect(sys).toContain('[Source 1] Flutter is a UI toolkit.');
    expect(sys).toContain('[Source 2] Dart is the language.');
    expect(sys).toContain('Knowledge Base Context');
  });

  it('includes sources in AI_STREAM_DONE payload', async () => {
    buildVolatileContext.mockResolvedValue({
      text: 'kb context',
      ragSources: [{ documentId: 'doc1', fileName: 'spec.pdf', score: 0.8 }],
    });
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      sources: [{ documentId: 'doc1', fileName: 'spec.pdf', score: 0.8 }],
    }));
  });

  it('emits a "no relevant context" signal when all scores below 0.5 threshold', async () => {
    buildVolatileContext.mockResolvedValue({
      text: '## Knowledge Base Context:\nNo relevant context: no uploaded-document chunk cleared the confidence threshold for this question.',
      ragSources: [],
    });
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const sys = systemText(mockStream.mock.calls[0][0]);
    expect(sys).toContain('No relevant context');
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({ sources: [] }));
  });

  it('signals no docs uploaded when conversation has none', async () => {
    buildVolatileContext.mockResolvedValue({
      text: '## Knowledge Base Context:\nNo documents have been uploaded to this conversation. Do not cite sources.',
      ragSources: [],
    });
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const sys = systemText(mockStream.mock.calls[0][0]);
    expect(sys).toContain('No documents have been uploaded');
  });

  it('degrades gracefully when embedding throws (no vector search)', async () => {
    embedOne.mockRejectedValue(new Error('embed unavailable'));
    // ContextBuilderService is mocked — still returns empty ragSources
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      sources: [],
    }));
  });

  // ─── Agentic loop ─────────────────────────────────────────────────────────

  it('executes single tool call then streams final answer', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(makeToolUseStream('search_messages', 'tool-1', { query: 'Flutter' }))
      .mockReturnValueOnce(makeStream(['Based on search: Flutter is great']));
    toolRegistryExecute.mockResolvedValue('Found: Flutter is great');

    await service.handleRequest(basePayload);

    expect(toolRegistryExecute).toHaveBeenCalledWith(
      'search_messages', { query: 'Flutter' },
      expect.objectContaining({ conversationId: 'conv-test' }),
    );
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_TOOL_CALL',
      toolName: 'search_messages',
    }));
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      fullContent: 'Based on search: Flutter is great',
      trace: expect.objectContaining({
        toolCalls: expect.arrayContaining([
          expect.objectContaining({ toolName: 'search_messages' }),
        ]),
      }),
    }));
  });

  it('executes two consecutive tool calls then streams final answer', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(makeToolUseStream('get_user_info', 'tool-1', {}))
      .mockReturnValueOnce(makeToolUseStream('search_messages', 'tool-2', { query: 'test' }))
      .mockReturnValueOnce(makeStream(['Final answer']));
    toolRegistryExecute.mockResolvedValue('result');

    await service.handleRequest(basePayload);

    expect(mockStream).toHaveBeenCalledTimes(3);
    expect(toolRegistryExecute).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
      fullContent: 'Final answer',
      trace: expect.objectContaining({
        toolCalls: expect.arrayContaining([
          expect.objectContaining({ toolName: 'get_user_info' }),
          expect.objectContaining({ toolName: 'search_messages' }),
        ]),
      }),
    }));
  });

  it('publishes fallback message when MAX_ITER exhausted', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream.mockReturnValue(makeToolUseStream('search_messages', 'tool-x', { query: 'x' }));
    toolRegistryExecute.mockResolvedValue('some result');

    await service.handleRequest(basePayload);

    expect(mockStream).toHaveBeenCalledTimes(5);
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_DONE',
    }));
  });

  // ─── Trace & token usage ──────────────────────────────────────────────────

  it('trace.processingMs >= 0 in AI_STREAM_DONE payload', async () => {
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const call = publish.mock.calls.find((c) => c[1]?.type === 'AI_STREAM_DONE');
    expect(call?.[1].trace.processingMs).toBeGreaterThanOrEqual(0);
  });

  it('counts usage once per streaming call (no double counting)', async () => {
    mockStream.mockReturnValue(makeStream(['OK'], { usage: { input_tokens: 10, output_tokens: 20 } }));

    await service.handleRequest(basePayload);

    const call = publish.mock.calls.find((c) => c[1]?.type === 'AI_STREAM_DONE');
    expect(call?.[1].trace.inputTokens).toBe(10);
    expect(call?.[1].trace.outputTokens).toBe(20);
  });

  it('accumulates usage across tool iterations', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(makeToolUseStream('search_messages', 't1', { query: 'x' })) // 8/12
      .mockReturnValueOnce(makeStream(['done'], { usage: { input_tokens: 10, output_tokens: 20 } }));
    toolRegistryExecute.mockResolvedValue('r');

    await service.handleRequest(basePayload);

    const call = publish.mock.calls.find((c) => c[1]?.type === 'AI_STREAM_DONE');
    expect(call?.[1].trace.inputTokens).toBe(18);
    expect(call?.[1].trace.outputTokens).toBe(32);
  });

  it('captures thinking blocks from the stream when present', async () => {
    mockStream.mockReturnValue(makeThinkingStream('Reasoning...', 'Final answer'));

    await service.handleRequest(basePayload);

    const call = publish.mock.calls.find((c) => c[1]?.type === 'AI_STREAM_DONE');
    expect(call?.[1].trace.thinkingBlocks).toContain('Reasoning...');
    expect(call?.[1].fullContent).toBe('Final answer');
  });

  it('calls usageService.recordUsage after a successful request', async () => {
    mockStream.mockReturnValue(makeStream(['OK'], { usage: { input_tokens: 10, output_tokens: 20 } }));

    await service.handleRequest(basePayload);
    await new Promise((r) => setTimeout(r, 10));

    expect(recordUsage).toHaveBeenCalledWith('user-1', 10, 20);
  });

  // ─── Quota enforcement ────────────────────────────────────────────────────

  it('publishes AI_STREAM_ERROR and skips Anthropic call when quota exceeded', async () => {
    isQuotaExceeded.mockResolvedValue(true);

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', {
      type: 'AI_STREAM_ERROR',
      code: 'AI_QUOTA_EXCEEDED',
      error: 'Monthly AI usage quota exceeded. Please contact your admin.',
    });
    expect(mockStream).not.toHaveBeenCalled();
  });

  // ─── Rate limiting ────────────────────────────────────────────────────────

  it('publishes AI_STREAM_ERROR (RATE_LIMITED) and skips Anthropic when throttled', async () => {
    acquire.mockResolvedValue({ allowed: false, reason: 'rate', release });

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_ERROR', code: 'AI_RATE_LIMITED' }),
    );
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('releases the concurrency slot after a successful request', async () => {
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    expect(acquire).toHaveBeenCalledWith('user-1');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases the concurrency slot even when both models fail', async () => {
    mockStream.mockImplementation(() => {
      throw new Error('model overloaded');
    });

    await expect(service.handleRequest(basePayload)).rejects.toThrow();

    expect(release).toHaveBeenCalledTimes(1);
  });

  // ─── Persona system prompt ────────────────────────────────────────────────

  it('uses personaService.buildSystemPrompt for the system prompt', async () => {
    buildSystemPromptFn.mockReturnValue('Custom persona prompt');
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    expect(buildSystemPromptFn).toHaveBeenCalled();
    const sys = systemText(mockStream.mock.calls[0][0]);
    expect(sys).toContain('Custom persona prompt');
  });
});
