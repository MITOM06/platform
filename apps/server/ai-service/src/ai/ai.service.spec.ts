import { ConfigService } from '@nestjs/config';
import { AiService, AiRequestPayload } from './ai.service';
import { AgenticLoopService } from './agentic-loop.service';
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
import { ConversationAccessService } from '../conversation/conversation-access.service';
import { SettingsService } from '../settings/settings.service';
import { ResolvedAiSettings } from '../settings/resolved-ai-settings';
import { ChatImageService } from './chat-image.service';
import { ToolRoundRunner } from './tool-round.runner';
import { PendingActionStore } from '../actions/pending-action.store';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RedisMock = require('ioredis-mock');

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
    usage?: Record<string, number>;
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

/** A tool_use turn that ALSO streams some text before issuing the tool call. */
function makeToolUseStreamWithText(
  text: string,
  toolName: string,
  toolId: string,
  input: Record<string, unknown>,
) {
  const events = [{ type: 'content_block_delta', delta: { type: 'text_delta', text } }];
  return {
    ...makeAsyncIterator(events),
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

/** A stream that emits some text deltas, then dies (network drop / 529 mid-stream). */
function makeFailingStream(texts: string[], error: Error) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const t of texts) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: t } };
      }
      throw error;
    },
    finalMessage: jest.fn().mockImplementation(() => Promise.reject(error)),
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
  let getMemory: jest.Mock;
  let embedOne: jest.Mock;
  let toolRegistryExecute: jest.Mock;
  let toolRegistryGetDefinitions: jest.Mock;
  let recordUsage: jest.Mock;
  let isQuotaExceeded: jest.Mock;
  let acquire: jest.Mock;
  let release: jest.Mock;
  let checkAccess: jest.Mock;
  /** null = unknown (default: direct-chat behaviour), true = 1-1 AI chat, false = shared chat. */
  let directAi: jest.Mock;
  let getPersona: jest.Mock;
  let buildSystemPromptFn: jest.Mock;
  let extractFacts: jest.Mock;
  let buildVolatileContext: jest.Mock;
  let getSettings: jest.Mock;
  let resolveImageBlocks: jest.Mock;
  // AI session fakes (Phase 1). `sessionMessages` is the session's text history
  // that buildMessageHistory returns — seed it per-test to simulate prior turns.
  let sessionMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  let getOrCreateActiveSession: jest.Mock;
  let buildMessageHistory: jest.Mock;
  let appendMessage: jest.Mock;
  let createNewSession: jest.Mock;
  let maybeCompact: jest.Mock;
  /** In-memory Redis behind the REAL PendingActionStore (§F2 confirmation flow). */
  let pendingRedis: any;

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
    getMemory = jest.fn().mockResolvedValue(null);
    embedOne = jest.fn().mockResolvedValue([0.1, 0.2]);
    toolRegistryExecute = jest.fn().mockResolvedValue('tool result');
    toolRegistryGetDefinitions = jest.fn().mockReturnValue([]);
    recordUsage = jest.fn().mockResolvedValue(undefined);
    isQuotaExceeded = jest.fn().mockResolvedValue(false);
    release = jest.fn().mockResolvedValue(undefined);
    acquire = jest.fn().mockResolvedValue({ allowed: true, release });
    checkAccess = jest.fn().mockResolvedValue('allowed');
    directAi = jest.fn().mockReturnValue(null);
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
    const fakeMemory = { incrementMessageCount, getMemory } as unknown as MemoryService;
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
      getEnabledSkillIds: jest.fn().mockResolvedValue([]),
    } as unknown as SkillsService;
    const fakeResponseCache = {
      isEnabled: false,
      lookup: jest.fn().mockResolvedValue(null),
      store: jest.fn().mockResolvedValue(undefined),
    } as unknown as ResponseCacheService;
    const fakeConversationAccess = {
      checkAccess,
      // Same single read as production: access + whether this is a direct AI chat.
      getConversationContext: jest.fn(async (convId: string, uid: string) => ({
        access: await checkAccess(convId, uid),
        directAi: directAi(),
      })),
    } as unknown as ConversationAccessService;
    // Default resolved settings = pure env behavior (all defaults), so existing
    // assertions are unaffected. Individual tests can override getSettings.
    const defaultSettings: ResolvedAiSettings = {
      personaName: null,
      defaultTone: null,
      modelTier: 'auto',
      webSearchEnabled: true,
      thinkingEnabled: false,
      monthlyTokenLimit: 500000,
      allowedConnectors: null,
      dailyDigestEnabled: false,
      dailyDigestHour: 8,
    };
    getSettings = jest.fn().mockResolvedValue(defaultSettings);
    const fakeSettings = { getSettings } as unknown as SettingsService;

    resolveImageBlocks = jest.fn().mockResolvedValue([]);
    const fakeChatImage = {
      isEnabled: () => true,
      resolveImageBlocks,
    } as unknown as ChatImageService;

    sessionMessages = [];
    const fakeSession = { _id: { toString: () => 'sess-1' }, messages: sessionMessages, summary: null };
    getOrCreateActiveSession = jest.fn().mockResolvedValue(fakeSession);
    buildMessageHistory = jest.fn(async () => sessionMessages.map((m) => ({ role: m.role, content: m.content })));
    appendMessage = jest.fn().mockResolvedValue(undefined);
    createNewSession = jest.fn().mockResolvedValue(fakeSession);
    const fakeAiSession = {
      getOrCreateActiveSession,
      buildMessageHistory,
      appendMessage,
      createNewSession,
      resumeSession: jest.fn(),
      listSessions: jest.fn(),
      renameSession: jest.fn(),
    } as unknown as import('../session/ai-session.service').AiSessionService;

    maybeCompact = jest.fn(async (s: unknown) => ({ session: s, compacted: false }));
    const fakeCompact = {
      maybeCompact,
    } as unknown as import('../session/compact.service').CompactService;

    // The agentic loop was extracted into its own injectable (clean-code 500-line
    // limit). Construct the REAL loop with the same fakes so streaming/tool
    // behavior is exercised end-to-end; AiService passes its `anthropic` client
    // into the loop, so the `service['anthropic']` override below still applies.
    pendingRedis = new RedisMock();
    const toolRound = new ToolRoundRunner(
      fakeToolRegistry,
      new PendingActionStore(pendingRedis, fakeConfig),
    );
    const agenticLoop = new AgenticLoopService(
      fakeConfig,
      fakeToolRegistry,
      fakeResponseCache,
      fakeChatImage,
      toolRound,
    );

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
      fakeConversationAccess,
      fakeSettings,
      fakeChatImage,
      fakeAiSession,
      fakeCompact,
      agenticLoop,
    );
    (service as any)['anthropic'] = { messages: { stream: mockStream, create: mockCreate } };
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // ioredis-mock instances share one in-memory store — isolate tests.
    await pendingRedis.flushall();
  });

  // ─── Basic streaming ──────────────────────────────────────────────────────

  it('publishes AI_STREAM_CHUNK for each delta then AI_STREAM_DONE', async () => {
    mockStream.mockReturnValue(makeStream(['Hello', ' World']));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({ type: 'AI_STREAM_CHUNK', chunk: 'Hello' }));
    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({ type: 'AI_STREAM_CHUNK', chunk: ' World' }));
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

  it('sends tools and a cached system block; omits effort for a non-effort model', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const params = mockStream.mock.calls[0][0];
    // The test model ('test-primary') is not effort-capable, so output_config
    // must be omitted — sending `effort` to such a model is a hard 400.
    expect(params.output_config).toBeUndefined();
    expect(Array.isArray(params.system)).toBe(true);
    expect(params.system[0].cache_control).toEqual({ type: 'ephemeral' });
    // last tool carries a cache breakpoint
    expect(params.tools[params.tools.length - 1].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('only sends output_config.effort for effort-capable models (regression: AI_UNAVAILABLE)', () => {
    const supports = (m: string) => (service as any).modelSupportsEffort(m);
    // Effort-capable — must receive output_config.effort
    for (const m of [
      'claude-opus-4-5',
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-sonnet-5',
      'claude-fable-5',
    ]) {
      expect(supports(m)).toBe(true);
    }
    // NOT effort-capable — sending `effort` here returns a 400 and breaks the turn
    for (const m of ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-1']) {
      expect(supports(m)).toBe(false);
    }
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

    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_ERROR',
      code: 'AI_UNAVAILABLE',
      error: 'AI is temporarily unavailable.',
    }));
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
    // Text history is now sourced from the session, not payload.history.
    sessionMessages.push({ role: 'user', content: 'What is Flutter?' });
    incrementMessageCount.mockResolvedValue(20);
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);
    await new Promise((r) => setTimeout(r, 50));

    expect(extractFacts).toHaveBeenCalledWith(
      'conv-test',
      'user-1',
      [{ role: 'user', content: 'What is Flutter?' }],
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
      { sensitive: false },
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

  // ─── Tool-result fencing (indirect prompt-injection defense) ──────────────

  it('fences connector/MCP tool_result content as UNTRUSTED before re-entry', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(makeToolUseStream('search_messages', 't1', { query: 'x' }))
      .mockReturnValueOnce(makeStream(['done']));
    toolRegistryExecute.mockResolvedValue('SECRET tool output');

    await service.handleRequest(basePayload);

    // messages is the same array reference across iterations — inspect final state.
    const messages = mockStream.mock.calls[0][0].messages as Array<{ content: unknown }>;
    const block = messages
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .find((b: any) => b.type === 'tool_result') as { content: string };
    expect(typeof block.content).toBe('string');
    expect(block.content).toContain('UNTRUSTED');
    expect(block.content).toContain('SECRET tool output');
  });

  it('does NOT double-wrap web_search results (already fenced at source)', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(makeToolUseStream('web_search', 't1', { query: 'x' }))
      .mockReturnValueOnce(makeStream(['done']));
    toolRegistryExecute.mockResolvedValue(
      '## Web Search Results\n<<<UNTRUSTED_DATA>>>\nbody\n<<<END_UNTRUSTED_DATA>>>',
    );

    await service.handleRequest(basePayload);

    const messages = mockStream.mock.calls[0][0].messages as Array<{ content: unknown }>;
    const block = messages
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .find((b: any) => b.type === 'tool_result') as { content: string };
    const opens = (block.content.match(/<<<UNTRUSTED_DATA>>>/g) || []).length;
    expect(opens).toBe(1);
  });

  // ─── Pre-tool-call streamed text preservation ─────────────────────────────

  it('preserves pre-tool-call streamed text in the final DONE + persisted message', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(
        makeToolUseStreamWithText('Let me check that.', 'search_messages', 't1', { query: 'x' }),
      )
      .mockReturnValueOnce(makeStream(['Here is the answer']));
    toolRegistryExecute.mockResolvedValue('r');

    await service.handleRequest(basePayload);

    const done = publish.mock.calls.find((c) => c[1]?.type === 'AI_STREAM_DONE');
    expect(done?.[1].fullContent).toBe('Let me check that.\nHere is the answer');
    // The persisted assistant turn must match what was streamed.
    const assistantTurns = appendMessage.mock.calls.filter((c) => c[1] === 'assistant');
    expect(assistantTurns[0][2]).toBe('Let me check that.\nHere is the answer');
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

    expect(recordUsage).toHaveBeenCalledWith(
      'user-1',
      { inputTokens: 10, outputTokens: 20, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
      { countRequest: true },
    );
  });

  // ─── Quota enforcement ────────────────────────────────────────────────────

  it('publishes AI_STREAM_ERROR and skips Anthropic call when quota exceeded', async () => {
    isQuotaExceeded.mockResolvedValue(true);

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith('conv-test', expect.objectContaining({
      type: 'AI_STREAM_ERROR',
      code: 'AI_QUOTA_EXCEEDED',
      error: 'Monthly AI usage quota exceeded. Please contact your admin.',
    }));
    expect(mockStream).not.toHaveBeenCalled();
  });

  // ─── Conversation access (defense-in-depth) ──────────────────────────────

  it('publishes AI_STREAM_ERROR (FORBIDDEN) and skips Anthropic when access denied', async () => {
    checkAccess.mockResolvedValue('denied');

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_ERROR', code: 'AI_FORBIDDEN' }),
    );
    expect(mockStream).not.toHaveBeenCalled();
  });

  it('proceeds when access is unknown (fail-open)', async () => {
    checkAccess.mockResolvedValue('unknown');
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    expect(mockStream).toHaveBeenCalled();
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

  // ─── Session: /new command ────────────────────────────────────────────────

  it('handles /new by starting a new session and skipping the model', async () => {
    const payload: AiRequestPayload = { ...basePayload, content: '/new' };

    await service.handleRequest(payload);

    expect(createNewSession).toHaveBeenCalledWith('user-1', 'conv-test');
    // No model call — the loop never streams for /new.
    expect(mockStream).not.toHaveBeenCalled();
    // A confirmation message is streamed via the normal Redis mechanism.
    expect(publish).toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_DONE' }),
    );
  });

  // ─── Memory inspection: /memory command ───────────────────────────────────

  it('handles /memory with no stored memory by returning the empty notice', async () => {
    getMemory.mockResolvedValue(null);
    const payload: AiRequestPayload = { ...basePayload, content: '/memory' };

    await service.handleRequest(payload);

    // No model call — served straight from the DB lookup.
    expect(mockStream).not.toHaveBeenCalled();
    expect(getMemory).toHaveBeenCalledWith('conv-test', 'user-1');
    expect(publish).toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({
        type: 'AI_STREAM_DONE',
        fullContent: expect.stringContaining('Tôi chưa ghi nhớ điều gì về bạn'),
      }),
    );
  });

  it('handles /ai-memory by returning the real stored summary + facts (no hallucination)', async () => {
    getMemory.mockResolvedValue({
      summary: 'User is a developer named Khang.',
      keyFacts: ['Uses NestJS', 'Uses Flutter'],
      messageCount: 7,
    });
    const payload: AiRequestPayload = { ...basePayload, content: '/ai-memory' };

    await service.handleRequest(payload);

    expect(mockStream).not.toHaveBeenCalled();
    const doneCall = publish.mock.calls.find((c) => c[1]?.type === 'AI_STREAM_DONE');
    expect(doneCall).toBeDefined();
    const body: string = doneCall![1].fullContent;
    expect(body).toContain('User is a developer named Khang.');
    expect(body).toContain('• Uses NestJS');
    expect(body).toContain('• Uses Flutter');
    expect(body).toContain('7 tin nhắn');
  });

  it('extracts facts on the FIRST turn at messageCount === 3', async () => {
    sessionMessages.push({ role: 'user', content: 'Tao tên là Khang' });
    incrementMessageCount.mockResolvedValue(3);
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);
    await new Promise((r) => setTimeout(r, 50));

    expect(extractFacts).toHaveBeenCalledWith(
      'conv-test',
      'user-1',
      [{ role: 'user', content: 'Tao tên là Khang' }],
      3,
    );
  });

  // ─── Session persistence: orphan-user defense (bug #1) ────────────────────

  it('persists user + assistant TOGETHER (user first) after a successful turn', async () => {
    mockStream.mockReturnValue(makeStream(['Answer']));

    await service.handleRequest(basePayload);

    // Both turns persisted, user before assistant (so auto-naming sees a user).
    const turnCalls = appendMessage.mock.calls.filter(
      (c) => c[1] === 'user' || c[1] === 'assistant',
    );
    expect(turnCalls).toEqual([
      ['sess-1', 'user', 'Hello AI'],
      ['sess-1', 'assistant', 'Answer'],
    ]);
  });

  it('persists NOTHING (no orphan user turn) when both models fail', async () => {
    mockStream.mockImplementation(() => {
      throw new Error('model overloaded');
    });

    await expect(service.handleRequest(basePayload)).rejects.toThrow();

    // The user turn must NOT have been persisted — otherwise the next request
    // produces two consecutive user turns → Anthropic 400 → bricked session.
    expect(appendMessage).not.toHaveBeenCalled();
  });

  it('does not persist a turn when the successful response is empty', async () => {
    mockStream.mockReturnValue(makeStream([])); // stream ends with no text

    await service.handleRequest(basePayload);

    expect(appendMessage).not.toHaveBeenCalled();
  });

  it('cached-response path persists BOTH the user and the cached assistant turn', async () => {
    (service as any)['responseCache'].lookup = jest.fn().mockResolvedValue('cached answer');

    await service.handleRequest(basePayload);

    // Model skipped, but the session stays consistent: user + assistant appended.
    expect(mockStream).not.toHaveBeenCalled();
    const turnCalls = appendMessage.mock.calls.filter(
      (c) => c[1] === 'user' || c[1] === 'assistant',
    );
    expect(turnCalls).toEqual([
      ['sess-1', 'user', 'Hello AI'],
      ['sess-1', 'assistant', 'cached answer'],
    ]);
  });

  it('never sends two consecutive same-role turns when summary priming meets a kept assistant turn', async () => {
    // buildMessageHistory (real behavior) prepends synthetic user+assistant when a
    // summary is set; simulate a kept slice that starts with an assistant turn.
    buildMessageHistory.mockResolvedValue([
      { role: 'user', content: '[Context from earlier conversation]\nsummary' },
      { role: 'assistant', content: 'Understood.' },
      { role: 'assistant', content: 'kept assistant turn' },
    ]);
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const messages = mockStream.mock.calls[0][0].messages as Array<{ role: string }>;
    expect(messages[0].role).toBe('user');
    for (let i = 1; i < messages.length; i++) {
      expect(messages[i].role).not.toBe(messages[i - 1].role);
    }
  });

  // ─── TASK-10 Vision: image history → image content blocks ─────────────────

  it('keeps text-only session history as plain-string content (byte-identical to before)', async () => {
    // Prior text turns now come from the session (source of truth), not payload.
    // Seed a proper user/assistant alternation — a healthy session always ends on
    // an assistant turn (user + assistant are persisted together after success).
    sessionMessages.push({ role: 'user', content: 'earlier question' });
    sessionMessages.push({ role: 'assistant', content: 'earlier answer' });
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const messages = mockStream.mock.calls[0][0].messages;
    expect(messages[0]).toEqual({ role: 'user', content: 'earlier question' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'earlier answer' });
    expect(messages[2]).toEqual({ role: 'user', content: 'Hello AI' });
    expect(resolveImageBlocks).not.toHaveBeenCalled();
  });

  it('maps an image history turn to image blocks before the caption text', async () => {
    resolveImageBlocks.mockResolvedValue([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } },
    ]);
    const payload: AiRequestPayload = {
      ...basePayload,
      history: [{ role: 'user', content: 'invoice', type: 'image', imageUrls: ['/api/uploads/1'] }],
    };
    mockStream.mockReturnValue(makeStream(['$42']));

    await service.handleRequest(payload);

    expect(resolveImageBlocks).toHaveBeenCalledWith(['/api/uploads/1']);
    const messages = mockStream.mock.calls[0][0].messages;
    const imgTurn = messages[0];
    expect(Array.isArray(imgTurn.content)).toBe(true);
    // image block precedes the text caption (claude-api vision constraint)
    expect(imgTurn.content[0].type).toBe('image');
    expect(imgTurn.content[1]).toEqual({ type: 'text', text: 'invoice' });
  });

  it('forces the primary model when a history image turn is present', async () => {
    // Router routes short prompts to a non-primary tier; image must override it.
    (service as any)['routerConfig'].enabled = true;
    resolveImageBlocks.mockResolvedValue([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } },
    ]);
    const payload: AiRequestPayload = {
      ...basePayload,
      content: 'hi',
      history: [{ role: 'user', content: '', type: 'image', imageUrls: ['/api/uploads/1'] }],
    };
    mockStream.mockReturnValue(makeStream(['answer']));

    await service.handleRequest(payload);

    expect(mockStream.mock.calls[0][0].model).toBe('test-primary');
  });

  it('drops an image turn entirely when no images resolve and caption is empty', async () => {
    resolveImageBlocks.mockResolvedValue([]); // all skipped (oversized/unsupported/404)
    const payload: AiRequestPayload = {
      ...basePayload,
      history: [{ role: 'user', content: '', type: 'image', imageUrls: ['/api/uploads/bad'] }],
    };
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(payload);

    const messages = mockStream.mock.calls[0][0].messages;
    // Only the current user turn remains — the empty image turn was dropped.
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello AI');
  });

  it('does not store the response cache when images were present', async () => {
    resolveImageBlocks.mockResolvedValue([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } },
    ]);
    const store = jest.fn().mockResolvedValue(undefined);
    (service as any)['responseCache'].store = store;
    const payload: AiRequestPayload = {
      ...basePayload,
      history: [{ role: 'user', content: 'q', type: 'image', imageUrls: ['/api/uploads/1'] }],
    };
    mockStream.mockReturnValue(makeStream(['answer']));

    await service.handleRequest(payload);

    expect(store).not.toHaveBeenCalled();
  });


  // ─── Fallback never re-runs a tool that already executed (bug 3) ──────────

  it('continues on the fallback model after a tool ran — the tool executes exactly once', async () => {
    // A side-effecting tool that runs WITHOUT confirmation (built-in). Sensitive
    // connector writes are held for confirmation instead — see the §F2 tests.
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    const seen: Array<{ model: string; messages: any[] }> = [];
    const capture = (impl: () => unknown) => (params: any) => {
      seen.push({ model: params.model, messages: JSON.parse(JSON.stringify(params.messages)) });
      return impl();
    };
    // Behaves like a real model: asks to send the email until it sees the result.
    const modelLike = (params: any) => () =>
      params.messages.some(
        (m: any) => Array.isArray(m.content) && m.content.some((b: any) => b.type === 'tool_result'),
      )
        ? makeStream(['Reminder set.'])
        : makeToolUseStream('create_reminder', `tu-${seen.length}`, { text: 'call Bob' });
    mockStream
      .mockImplementationOnce((params: any) => capture(modelLike(params))(params))
      .mockImplementationOnce(
        capture(() => {
          throw new Error('529 overloaded');
        }),
      )
      .mockImplementation((params: any) => capture(modelLike(params))(params));
    toolRegistryExecute.mockResolvedValue('Reminder created');

    await service.handleRequest(basePayload);

    // The side-effecting tool ran ONCE — the fallback continued, it did not restart.
    expect(toolRegistryExecute).toHaveBeenCalledTimes(1);
    expect(seen.map((c) => c.model)).toEqual(['test-primary', 'test-primary', 'test-fallback']);
    const fallbackMessages = seen[2].messages;
    expect(fallbackMessages).toHaveLength(3); // user, assistant(tool_use), user(tool_result)
    expect(fallbackMessages[1].content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'tool_use', id: 'tu-1' })]),
    );
    expect(fallbackMessages[2].content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'tool_result', tool_use_id: 'tu-1' })]),
    );
    expect(publish).toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_DONE', fullContent: 'Reminder set.' }),
    );
    expect(publish).not.toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_ERROR' }),
    );
  });

  it('ends with AI_STREAM_INTERRUPTED (no fallback, no re-run) when the failed turn had streamed text', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(makeToolUseStream('create_reminder', 'tu-1', { text: 'x' }))
      .mockReturnValueOnce(makeFailingStream(['Đã đặt nhắc'], new Error('socket hang up')));
    toolRegistryExecute.mockResolvedValue('Reminder set');

    await expect(service.handleRequest(basePayload)).rejects.toThrow();

    expect(toolRegistryExecute).toHaveBeenCalledTimes(1);
    expect(mockStream).toHaveBeenCalledTimes(2); // the fallback was NOT started
    const errors = publish.mock.calls.filter((c) => c[1]?.type === 'AI_STREAM_ERROR');
    expect(errors).toHaveLength(1);
    expect(errors[0][1]).toMatchObject({ code: 'AI_STREAM_INTERRUPTED' });
  });

  it('continues on the fallback when the stream dies after pre-tool text but before new text', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(
        makeToolUseStreamWithText('Let me check.', 'search_messages', 't1', { query: 'x' }),
      )
      .mockReturnValueOnce(makeFailingStream([], new Error('ECONNRESET')))
      .mockReturnValueOnce(makeStream(['Found it.']));
    toolRegistryExecute.mockResolvedValue('r');

    await service.handleRequest(basePayload);

    expect(toolRegistryExecute).toHaveBeenCalledTimes(1);
    const done = publish.mock.calls.find((c) => c[1]?.type === 'AI_STREAM_DONE');
    expect(done?.[1].fullContent).toBe('Let me check.\nFound it.');
  });

  it('publishes exactly one AI_STREAM_ERROR when both models fail', async () => {
    mockStream.mockImplementation(() => {
      throw new Error('model overloaded');
    });

    await expect(service.handleRequest(basePayload)).rejects.toThrow();

    const errors = publish.mock.calls.filter((c) => c[1]?.type === 'AI_STREAM_ERROR');
    expect(errors).toHaveLength(1);
  });

  // ─── Failures always reach the client (bug 12) ────────────────────────────

  it('publishes AI_EMPTY_RESPONSE instead of a blank DONE when the model returns no text', async () => {
    mockStream.mockReturnValue(makeStream([], { stop_reason: 'refusal', content: [] }));

    await service.handleRequest(basePayload);

    expect(publish).toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_ERROR', code: 'AI_EMPTY_RESPONSE', stopReason: 'refusal' }),
    );
    expect(publish).not.toHaveBeenCalledWith(
      'conv-test',
      expect.objectContaining({ type: 'AI_STREAM_DONE' }),
    );
    expect(appendMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['settings', () => getSettings.mockRejectedValue(new Error('MongoNetworkError'))],
    ['quota', () => isQuotaExceeded.mockRejectedValue(new Error('MongoNetworkError'))],
    ['session', () => getOrCreateActiveSession.mockRejectedValue(new Error('MongoNetworkError'))],
    ['compaction', () => maybeCompact.mockRejectedValue(new Error('MongoNetworkError'))],
    ['persona', () => getPersona.mockRejectedValue(new Error('MongoNetworkError'))],
  ])('publishes AI_UNAVAILABLE when %s setup fails before the model runs', async (_name, breakIt) => {
    breakIt();

    await expect(service.handleRequest(basePayload)).rejects.toThrow('MongoNetworkError');

    expect(mockStream).not.toHaveBeenCalled();
    const errors = publish.mock.calls.filter((c) => c[1]?.type === 'AI_STREAM_ERROR');
    expect(errors).toHaveLength(1);
    expect(errors[0][1]).toMatchObject({ code: 'AI_UNAVAILABLE', requesterId: 'user-1' });
  });

  // ─── replyId / requesterId on every stream event (14) ─────────────────────

  it('tags every stream event of a reply with one replyId and the requesterId', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(makeToolUseStream('search_messages', 't1', { query: 'x' }))
      .mockReturnValueOnce(makeStream(['A', 'B']));

    await service.handleRequest(basePayload);

    const events = publish.mock.calls.map((c) => c[1]);
    expect(events.map((e) => e.type)).toEqual([
      'AI_TOOL_CALL',
      'AI_STREAM_CHUNK',
      'AI_STREAM_CHUNK',
      'AI_STREAM_DONE',
    ]);
    const replyIds = new Set(events.map((e) => e.replyId));
    expect(replyIds.size).toBe(1);
    expect([...replyIds][0]).toEqual(expect.any(String));
    expect(events.every((e) => e.requesterId === 'user-1')).toBe(true);
  });

  it('gives a compaction notice its own replyId (chat-service dedupes DONE per replyId)', async () => {
    maybeCompact.mockImplementation(async (sess: unknown) => ({ session: sess, compacted: true }));
    mockStream.mockReturnValue(makeStream(['Answer']));

    await service.handleRequest(basePayload);

    const dones = publish.mock.calls.map((c) => c[1]).filter((e) => e.type === 'AI_STREAM_DONE');
    expect(dones).toHaveLength(2);
    expect(dones[1].fullContent).toBe('Answer');
    expect(dones[0].replyId).not.toBe(dones[1].replyId);
  });

  // ─── Memory isolation in groups (bug 1) ───────────────────────────────────

  it("/memory in a group shows only the requester's own facts", async () => {
    const docs: Record<string, unknown> = {
      alice: { summary: 'Alice talked about her salary', keyFacts: ['Alice salary is 90M'], messageCount: 3 },
      bob: { summary: 'Bob asked about tea', keyFacts: ['Bob likes tea'], messageCount: 2 },
    };
    getMemory.mockImplementation(async (_conv: string, uid: string) => docs[uid] ?? null);

    await service.handleRequest({ ...basePayload, userId: 'bob', displayName: 'Bob', content: '/memory' });

    expect(getMemory).toHaveBeenCalledWith('conv-test', 'bob');
    const done = publish.mock.calls.find((c) => c[1]?.type === 'AI_STREAM_DONE');
    expect(done?.[1].fullContent).toContain('Bob likes tea');
    expect(done?.[1].fullContent).not.toContain('Alice');
    expect(done?.[1].requesterId).toBe('bob');
  });

  it('counts turns per (conversation, user)', async () => {
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    expect(incrementMessageCount).toHaveBeenCalledWith('conv-test', 'user-1');
  });

  // ─── Group context + sliding window (bug 9) ───────────────────────────────

  it('in a shared chat, injects the recent conversation with display names (no ids, no system codes)', async () => {
    directAi.mockReturnValue(false);
    const payload: AiRequestPayload = {
      ...basePayload,
      content: 'what did Lan just propose?',
      history: [
        { role: 'user', content: 'Let us move the launch to Friday', senderId: '6650a1b2c3d4e5f6a7b8c9d0', senderName: 'Lan' },
        { role: 'user', content: 'system.nickname.changed:6650a1b2c3d4e5f6a7b8c9d0:Lanny', senderId: '6650a1b2c3d4e5f6a7b8c9d0' },
        { role: 'user', content: 'I prefer Monday', senderId: '6650a1b2c3d4e5f6a7b8c9d1' },
        { role: 'assistant', content: 'Noted.' },
        { role: 'user', content: 'what did Lan just propose?', senderId: 'user-1', senderName: 'Alice' },
      ],
    };
    mockStream.mockReturnValue(makeStream(['Lan proposed Friday.']));

    await service.handleRequest(payload);

    const params = mockStream.mock.calls[0][0];
    const sys = systemText(params);
    expect(sys).toContain('Recent conversation');
    expect(sys).toContain('Lan: Let us move the launch to Friday');
    expect(sys).toContain('A member: I prefer Monday');
    expect(sys).toContain('PON AI: Noted.');
    expect(sys).not.toContain('system.nickname');
    expect(sys).not.toContain('6650a1b2c3d4e5f6a7b8c9d');
    // The current question is the final user turn — not repeated in the block.
    expect(sys).not.toContain('what did Lan just propose?');
    expect(params.messages[params.messages.length - 1]).toEqual({
      role: 'user',
      content: 'what did Lan just propose?',
    });
  });

  it('does not add the group block in a direct AI chat', async () => {
    directAi.mockReturnValue(true);
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest({
      ...basePayload,
      history: [{ role: 'user', content: 'older message', senderName: 'Alice' }],
    });

    expect(systemText(mockStream.mock.calls[0][0])).not.toContain('Recent conversation');
  });

  it('caps the verbatim session history to the 20-message window', async () => {
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    expect(buildMessageHistory).toHaveBeenCalledWith(expect.anything(), 20);
  });

  it('skips the response cache when the answer depends on the group conversation', async () => {
    directAi.mockReturnValue(false);
    const lookup = jest.fn().mockResolvedValue('cached');
    const store = jest.fn().mockResolvedValue(undefined);
    (service as any)['responseCache'].lookup = lookup;
    (service as any)['responseCache'].store = store;
    mockStream.mockReturnValue(makeStream(['fresh']));

    await service.handleRequest({
      ...basePayload,
      history: [{ role: 'user', content: 'earlier group message', senderName: 'Lan' }],
    });

    expect(lookup).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
    expect(mockStream).toHaveBeenCalled();
  });

  it('keys the response cache on the requester', async () => {
    const lookup = jest.fn().mockResolvedValue(null);
    const store = jest.fn().mockResolvedValue(undefined);
    (service as any)['responseCache'].lookup = lookup;
    (service as any)['responseCache'].store = store;
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    expect(lookup).toHaveBeenCalledWith('conv-test', 'user-1', [0.1, 0.2]);
    expect(store).toHaveBeenCalledWith('conv-test', 'user-1', [0.1, 0.2], 'OK');
  });

  // ─── Thinking on any capable routed model (14) ────────────────────────────

  it('applies the thinking toggle to a routed non-primary model that supports adaptive thinking', async () => {
    const base = await getSettings();
    getSettings.mockResolvedValue({ ...base, thinkingEnabled: true, modelTier: 'mid' });
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const params = mockStream.mock.calls[0][0];
    expect(params.model).toBe('claude-sonnet-4-6');
    expect(params.thinking).toEqual({ type: 'adaptive', display: 'summarized' });
  });

  it('never sends adaptive thinking to a model without it (haiku)', async () => {
    const base = await getSettings();
    getSettings.mockResolvedValue({ ...base, thinkingEnabled: true, modelTier: 'simple' });
    mockStream.mockReturnValue(makeStream(['OK']));

    await service.handleRequest(basePayload);

    const params = mockStream.mock.calls[0][0];
    expect(params.model).toBe('claude-haiku-4-5');
    expect(params.thinking).toBeUndefined();
  });

  // ─── Usage includes prompt-cache tokens (bug 6) ───────────────────────────

  it('counts prompt-cache writes and reads in the trace and the recorded usage', async () => {
    mockStream.mockReturnValue(
      makeStream(['OK'], {
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: 5,
          cache_read_input_tokens: 100,
        },
      }),
    );

    await service.handleRequest(basePayload);
    await new Promise((r) => setTimeout(r, 10));

    const done = publish.mock.calls.find((c) => c[1]?.type === 'AI_STREAM_DONE');
    expect(done?.[1].trace).toMatchObject({
      inputTokens: 115,
      outputTokens: 20,
      cachedInputTokens: 100,
      cacheCreationInputTokens: 5,
    });
    expect(recordUsage).toHaveBeenCalledWith(
      'user-1',
      { inputTokens: 115, outputTokens: 20, cacheCreationInputTokens: 5, cacheReadInputTokens: 100 },
      { countRequest: true },
    );
  });

  it('records the tokens of a failed request without counting it as a reply', async () => {
    toolRegistryGetDefinitions.mockReturnValue(SAMPLE_TOOLS);
    mockStream
      .mockReturnValueOnce(makeToolUseStream('search_messages', 't1', { query: 'x' })) // 8/12
      .mockImplementation(() => {
        throw new Error('overloaded');
      });

    await expect(service.handleRequest(basePayload)).rejects.toThrow();

    expect(recordUsage).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ inputTokens: 8, outputTokens: 12 }),
      { countRequest: false },
    );
  });
  // ─── OpenRouter light tier (cost split) ───────────────────────────────────
  describe('OpenRouter light tier', () => {
    let orStream: jest.Mock;

    beforeEach(() => {
      // Router on: a short first message with no history is the fast tier.
      (service as any).routerConfig = { ...(service as any).routerConfig, enabled: true };
      orStream = jest.fn().mockReturnValue(makeStream(['Chào bạn']));
      (service as any).llm = {
        openRouterEnabled: true,
        lightModel: 'google/gemini-2.5-flash-lite',
        clientFor: () => ({ messages: { stream: orStream, create: jest.fn() } }),
      };
    });

    it('answers a fast-tier turn on the OpenRouter light model, not Claude', async () => {
      await service.handleRequest(basePayload);

      expect(orStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'google/gemini-2.5-flash-lite' }),
      );
      expect(mockStream).not.toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        'conv-test',
        expect.objectContaining({ type: 'AI_STREAM_DONE', fullContent: 'Chào bạn' }),
      );
    });

    it('falls back to the Claude fallback model when OpenRouter fails before any text', async () => {
      orStream.mockImplementation(() => {
        throw new Error('OpenRouter 402: no credits');
      });
      mockStream.mockReturnValue(makeStream(['From Claude']));

      await service.handleRequest(basePayload);

      expect(mockStream).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-fallback' }));
      expect(publish).toHaveBeenCalledWith(
        'conv-test',
        expect.objectContaining({ type: 'AI_STREAM_DONE', fullContent: 'From Claude' }),
      );
    });

    it('runs a tier mapped to an OpenRouter model (mid) on OpenRouter', async () => {
      (service as any).routerConfig = {
        ...(service as any).routerConfig,
        midModel: 'google/gemini-2.5-flash',
      };
      await service.handleRequest({ ...basePayload, content: 'x'.repeat(600) });

      expect(orStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'google/gemini-2.5-flash' }),
      );
      expect(mockStream).not.toHaveBeenCalled();
    });

    it('sends an OpenRouter-mapped tier to the Claude fallback when OpenRouter is off', async () => {
      (service as any).llm = { openRouterEnabled: false, lightModel: 'claude-haiku-4-5' };
      (service as any).routerConfig = {
        ...(service as any).routerConfig,
        midModel: 'google/gemini-2.5-flash',
      };
      await service.handleRequest({ ...basePayload, content: 'x'.repeat(600) });

      expect(mockStream).toHaveBeenCalledWith(expect.objectContaining({ model: 'test-fallback' }));
    });

    it('keeps mid / complex turns on Claude', async () => {
      await service.handleRequest({ ...basePayload, content: 'x'.repeat(600) });

      expect(orStream).not.toHaveBeenCalled();
      expect(mockStream).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-6' }),
      );
    });
  });
});
