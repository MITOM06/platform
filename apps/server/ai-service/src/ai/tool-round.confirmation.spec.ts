import { ConfigService } from '@nestjs/config';
import { AgenticLoopService } from './agentic-loop.service';
import { ToolRoundRunner, PENDING_CONFIRMATION_RESULT, TOOL_NOT_OFFERED_RESULT } from './tool-round.runner';
import { AiReplyStream } from './ai-reply-stream';
import { RequestContext } from './ai.types';
import { ACTION_PENDING_FALLBACK_TEXT } from './system-notices';
import { PendingActionStore } from '../actions/pending-action.store';
import { pendingActionKey } from '../actions/pending-action.types';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ToolDefinition } from '../tools/tool.interface';
import { ResponseCacheService } from './response-cache.service';
import { ChatImageService } from './chat-image.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RedisMock = require('ioredis-mock');

const schema = { type: 'object' as const, properties: {}, required: [] as string[] };
const SEND: ToolDefinition = { name: 'mcp__gmail__send_email', description: 'Send', input_schema: schema, sensitive: true };
const DRAFT: ToolDefinition = { name: 'mcp__gmail__create_draft', description: 'Draft', input_schema: schema, sensitive: true };
const SEARCH: ToolDefinition = { name: 'mcp__gmail__search_threads', description: 'Search', input_schema: schema, sensitive: false };
const REMINDER: ToolDefinition = { name: 'create_reminder', description: 'Remind', input_schema: schema };
const EMAIL_INPUT = { to: 'bob@example.com', subject: 'Q3 report', body: 'SECRET BODY' };

function asyncIter(events: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const e of events) yield e;
    },
  };
}

function textTurn(text: string) {
  const events = text ? [{ type: 'content_block_delta', delta: { type: 'text_delta', text } }] : [];
  return {
    ...asyncIter(events),
    finalMessage: jest.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: text ? [{ type: 'text', text }] : [],
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  };
}

function toolTurn(name: string, id: string, input: Record<string, unknown>) {
  return {
    ...asyncIter([]),
    finalMessage: jest.fn().mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id, name, input }],
      usage: { input_tokens: 8, output_tokens: 4 },
    }),
  };
}

function failingTurn(error: Error) {
  return {
    [Symbol.asyncIterator]: async function* () {
      throw error;
    },
    finalMessage: jest.fn().mockRejectedValue(error),
  };
}

/** Behaves like a model: asks for the tool until it sees a tool_result, then answers. */
function modelLike(name: string, input: Record<string, unknown>, answer: string) {
  return (params: any) =>
    params.messages.some(
      (m: any) => Array.isArray(m.content) && m.content.some((b: any) => b.type === 'tool_result'),
    )
      ? textTurn(answer)
      : toolTurn(name, `tu-${params.messages.length}`, input);
}

function toolResults(params: any): any[] {
  return params.messages
    .flatMap((m: any) => (Array.isArray(m.content) ? m.content : []))
    .filter((b: any) => b.type === 'tool_result');
}

describe('ToolRoundRunner — in-chat confirmation of sensitive actions (§F2)', () => {
  let redis: any;
  let publish: jest.Mock;
  let execute: jest.Mock;
  let getDefinitions: jest.Mock;
  let mockStream: jest.Mock;
  let store: PendingActionStore;
  let loop: AgenticLoopService;
  let stream: AiReplyStream;

  const config = { get: jest.fn(() => undefined) } as unknown as ConfigService;
  const ctx: RequestContext = {
    conversationId: 'conv-1',
    userId: 'user-1',
    displayName: 'Alice',
    perms: [],
    departmentIds: [],
    baseSystem: 'You are PON AI.',
    volatileSystem: '',
    ragSources: [],
    responseCacheable: false,
    settings: {
      personaName: null,
      defaultTone: null,
      modelTier: 'auto',
      webSearchEnabled: true,
      thinkingEnabled: false,
      monthlyTokenLimit: 500000,
      allowedConnectors: null,
      dailyDigestEnabled: false,
      dailyDigestHour: 8,
    },
  };

  beforeEach(() => {
    redis = new RedisMock();
    publish = jest.fn().mockResolvedValue(undefined);
    execute = jest.fn().mockResolvedValue('done');
    getDefinitions = jest.fn().mockResolvedValue([SEND, DRAFT, SEARCH, REMINDER]);
    mockStream = jest.fn();
    store = new PendingActionStore(redis, config);
    const registry = { getDefinitions, execute } as unknown as ToolRegistryService;
    loop = new AgenticLoopService(
      config,
      registry,
      { store: jest.fn() } as unknown as ResponseCacheService,
      { resolveImageBlocks: jest.fn().mockResolvedValue([]) } as unknown as ChatImageService,
      new ToolRoundRunner(registry, store),
    );
    stream = new AiReplyStream({ publish } as unknown as RedisPublisherService, 'conv-1', 'user-1');
  });

  afterEach(async () => {
    await redis.flushall();
  });

  async function runLoop(content = 'Email Bob the Q3 report') {
    const state = await loop.prepare(ctx, content, []);
    const trace = await loop.runWithFallback({
      anthropic: { messages: { stream: mockStream } } as any,
      primaryModel: 'test-primary',
      fallbackModel: 'test-fallback',
      ctx,
      state,
      stream,
      startMs: Date.now(),
    });
    return { state, trace };
  }

  const events = () => publish.mock.calls.map((c) => c[1]);
  const pendingKeys = async () => redis.keys('ai:pending-action:*');

  it('holds a sensitive connector write as a pending action instead of executing it', async () => {
    mockStream
      .mockReturnValueOnce(toolTurn(SEND.name, 'tu-1', EMAIL_INPUT))
      .mockReturnValueOnce(textTurn('I prepared the email — confirm it below.'));

    const { state, trace } = await runLoop();

    expect(execute).not.toHaveBeenCalled();
    expect(state.toolsExecuted).toBe(0); // it did not run — not a side effect
    const pending = events().find((e) => e.type === 'AI_ACTION_PENDING');
    expect(pending).toEqual(
      expect.objectContaining({
        type: 'AI_ACTION_PENDING',
        replyId: stream.replyId,
        requesterId: 'user-1',
        action: {
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          toolName: 'mcp__gmail__send_email',
          provider: 'gmail',
          summary: { kind: 'send_email', to: 'bob@example.com', subject: 'Q3 report' },
          status: 'pending',
          expiresAt: expect.any(String),
        },
      }),
    );
    const done = events().find((e) => e.type === 'AI_STREAM_DONE');
    expect(done.pendingActions).toEqual([pending.action]);
    expect(done.fullContent).toBe('I prepared the email — confirm it below.');
    // The card carries a summary only — the body stays in the server-side record.
    expect(JSON.stringify(done.pendingActions)).not.toContain('SECRET BODY');
    expect(trace.toolCalls).toEqual([
      expect.objectContaining({ toolName: SEND.name, resultSummary: 'Awaiting user confirmation' }),
    ]);

    // The model was told it waits — not an error, not fenced tool output.
    const [result] = toolResults(mockStream.mock.calls[1][0]);
    expect(result).toEqual({ type: 'tool_result', tool_use_id: 'tu-1', content: PENDING_CONFIRMATION_RESULT });

    // The record keeps the exact input for confirm, with TTL = 10 min + grace.
    const raw = await redis.get(pendingActionKey(pending.action.id));
    expect(JSON.parse(raw)).toMatchObject({
      userId: 'user-1',
      conversationId: 'conv-1',
      replyId: stream.replyId,
      toolName: SEND.name,
      input: EMAIL_INPUT,
      requestText: 'Email Bob the Q3 report',
    });
    const ttl = await redis.ttl(pendingActionKey(pending.action.id));
    expect(ttl).toBeGreaterThan(600);
    expect(ttl).toBeLessThanOrEqual(900);
    const expiresIn = Date.parse(pending.action.expiresAt) - Date.now();
    expect(expiresIn).toBeGreaterThan(590_000);
    expect(expiresIn).toBeLessThanOrEqual(600_000);
  });

  it('emits AI_TOOL_CALL then AI_ACTION_PENDING before the text, all on one replyId', async () => {
    mockStream
      .mockReturnValueOnce(toolTurn(SEND.name, 'tu-1', EMAIL_INPUT))
      .mockReturnValueOnce(textTurn('Please confirm.'));

    await runLoop();

    expect(events().map((e) => e.type)).toEqual([
      'AI_TOOL_CALL',
      'AI_ACTION_PENDING',
      'AI_STREAM_CHUNK',
      'AI_STREAM_DONE',
    ]);
    expect(new Set(events().map((e) => e.replyId)).size).toBe(1);
    expect(events()[0]).toMatchObject({ toolName: SEND.name, sensitive: true });
  });

  it('runs the low-risk create_draft directly although connector-service flags it sensitive', async () => {
    mockStream.mockImplementation(modelLike(DRAFT.name, EMAIL_INPUT, 'Draft saved.'));

    const { state } = await runLoop();

    expect(execute).toHaveBeenCalledWith(DRAFT.name, EMAIL_INPUT, expect.anything(), { sensitive: true });
    expect(state.toolsExecuted).toBe(1);
    expect(events().some((e) => e.type === 'AI_ACTION_PENDING')).toBe(false);
    expect(await pendingKeys()).toHaveLength(0);
  });

  it.each([
    ['a built-in (create_reminder)', REMINDER.name],
    ['a read-only connector tool', SEARCH.name],
  ])('executes %s without confirmation', async (_label, name) => {
    mockStream.mockImplementation(modelLike(name, { q: 'x' }, 'Done.'));

    await runLoop();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(events().some((e) => e.type === 'AI_ACTION_PENDING')).toBe(false);
  });

  it('refuses a connector tool that was not offered this request (never executed, never staged)', async () => {
    getDefinitions.mockResolvedValue([REMINDER]); // e.g. filtered by the AI allow-list
    mockStream.mockImplementation(modelLike(SEND.name, EMAIL_INPUT, 'I cannot send email here.'));

    await runLoop();

    expect(execute).not.toHaveBeenCalled();
    expect(await pendingKeys()).toHaveLength(0);
    const [result] = toolResults(mockStream.mock.calls[1][0]);
    expect(result).toMatchObject({ is_error: true, content: TOOL_NOT_OFFERED_RESULT });
    expect(events().some((e) => e.type === 'AI_TOOL_CALL')).toBe(false);
  });

  it('never forwards sensitive / actionGroup to Anthropic', async () => {
    getDefinitions.mockResolvedValue([
      { ...SEND, actionGroup: 'create' } as unknown as ToolDefinition,
      SEARCH,
      REMINDER,
    ]);
    mockStream.mockReturnValueOnce(textTurn('Hi'));

    await runLoop();

    const tools = mockStream.mock.calls[0][0].tools as Array<Record<string, unknown>>;
    expect(tools.map((t) => t.name)).toEqual([SEND.name, SEARCH.name, REMINDER.name]);
    for (const tool of tools) {
      expect(Object.keys(tool).sort()).toEqual(
        expect.arrayContaining(['description', 'input_schema', 'name']),
      );
      expect(tool).not.toHaveProperty('sensitive');
      expect(tool).not.toHaveProperty('actionGroup');
    }
  });

  it('continues on the fallback after a pending round without re-staging or executing it', async () => {
    mockStream
      .mockReturnValueOnce(toolTurn(SEND.name, 'tu-1', EMAIL_INPUT))
      .mockImplementationOnce(() => {
        throw new Error('529 overloaded');
      })
      // The fallback asks for the very same action again before answering.
      .mockReturnValueOnce(toolTurn(SEND.name, 'tu-2', { subject: 'Q3 report', body: 'SECRET BODY', to: 'bob@example.com' }))
      .mockReturnValueOnce(textTurn('Confirm the email below.'));

    const { state } = await runLoop();

    expect(execute).not.toHaveBeenCalled();
    expect(state.toolsExecuted).toBe(0);
    expect(mockStream.mock.calls.map((c) => c[0].model)).toEqual([
      'test-primary',
      'test-primary',
      'test-fallback',
      'test-fallback',
    ]);
    // One action, announced once, carried once on DONE; both tool_uses got the pending result.
    expect(await pendingKeys()).toHaveLength(1);
    expect(events().filter((e) => e.type === 'AI_ACTION_PENDING')).toHaveLength(1);
    const done = events().find((e) => e.type === 'AI_STREAM_DONE');
    expect(done.pendingActions).toHaveLength(1);
    const results = toolResults(mockStream.mock.calls[3][0]);
    expect(results.map((r) => r.content)).toEqual([PENDING_CONFIRMATION_RESULT, PENDING_CONFIRMATION_RESULT]);
  });

  it('drops the pending action when the reply ends in an error (no card survives it)', async () => {
    mockStream
      .mockReturnValueOnce(toolTurn(SEND.name, 'tu-1', EMAIL_INPUT))
      .mockImplementation(() => {
        throw new Error('529 overloaded');
      });

    await expect(runLoop()).rejects.toThrow('529');

    expect(execute).not.toHaveBeenCalled();
    expect(await pendingKeys()).toHaveLength(0);
    expect(events().filter((e) => e.type === 'AI_STREAM_ERROR')).toHaveLength(1);
    expect(events().some((e) => e.type === 'AI_STREAM_DONE')).toBe(false);
  });

  it('still ends with DONE carrying the card when the model adds no text', async () => {
    mockStream
      .mockReturnValueOnce(toolTurn(SEND.name, 'tu-1', EMAIL_INPUT))
      .mockReturnValueOnce(textTurn(''));

    await runLoop();

    const done = events().find((e) => e.type === 'AI_STREAM_DONE');
    expect(done.fullContent).toBe(ACTION_PENDING_FALLBACK_TEXT);
    expect(done.pendingActions).toHaveLength(1);
    expect(events().some((e) => e.type === 'AI_STREAM_ERROR')).toBe(false);
  });

  it('fails closed when the action cannot be stored (Redis down): nothing runs', async () => {
    jest.spyOn(redis, 'set').mockRejectedValue(new Error('ECONNREFUSED'));
    mockStream.mockImplementation(modelLike(SEND.name, EMAIL_INPUT, 'Could not prepare it.'));

    await runLoop();

    expect(execute).not.toHaveBeenCalled();
    const [result] = toolResults(mockStream.mock.calls[1][0]);
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('NOT performed');
    const done = events().find((e) => e.type === 'AI_STREAM_DONE');
    expect(done.pendingActions).toBeUndefined();
  });

  it('holds a connector tool whose definition carries no sensitive flag (fail closed)', async () => {
    const { sensitive: _drop, ...unflagged } = SEND;
    getDefinitions.mockResolvedValue([unflagged]);
    mockStream
      .mockReturnValueOnce(toolTurn(SEND.name, 'tu-1', EMAIL_INPUT))
      .mockReturnValueOnce(textTurn('Confirm below.'));

    await runLoop();

    expect(execute).not.toHaveBeenCalled();
    expect(await pendingKeys()).toHaveLength(1);
  });
});
