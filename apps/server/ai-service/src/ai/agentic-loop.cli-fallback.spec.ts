import { ConfigService } from '@nestjs/config';
import { AgenticLoopService } from './agentic-loop.service';
import { ToolRoundRunner } from './tool-round.runner';
import { AiReplyStream } from './ai-reply-stream';
import { RequestContext } from './ai.types';
import { ClaudeCliClient, CliLoopResult } from '../llm/claude-cli.client';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ResponseCacheService } from './response-cache.service';
import { ChatImageService } from './chat-image.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';

/**
 * Provider fallback: the primary may be the Claude Code subscription
 * (ClaudeCliClient). A CLI failure BEFORE any text continues on the API model;
 * a failure AFTER text was streamed must not start a second answer
 * (AI_STREAM_INTERRUPTED); both failing ends in AI_UNAVAILABLE.
 */
function asyncIter(events: unknown[]) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const e of events) yield e;
    },
  };
}

function apiTextTurn(text: string) {
  return {
    ...asyncIter([{ type: 'content_block_delta', delta: { type: 'text_delta', text } }]),
    finalMessage: jest.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text }],
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  };
}

function apiFailingTurn(err: Error) {
  return {
    [Symbol.asyncIterator]: async function* () {
      throw err;
    },
    finalMessage: jest.fn().mockRejectedValue(err),
  };
}

function cliResult(over: Partial<CliLoopResult> = {}): CliLoopResult {
  return {
    text: 'cli answer',
    usage: { inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    stopReason: 'end_turn',
    numTurns: 1,
    costUsd: 0.01,
    thinkingBlocks: ['pondering'],
    ...over,
  } as CliLoopResult;
}

function makeCli(runLoop: jest.Mock): ClaudeCliClient {
  const cli = Object.create(ClaudeCliClient.prototype) as ClaudeCliClient;
  (cli as unknown as { runLoop: jest.Mock }).runLoop = runLoop;
  return cli;
}

describe('AgenticLoopService — Claude CLI primary with API fallback', () => {
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

  let publish: jest.Mock;
  let apiStream: jest.Mock;
  let toolRound: { runToolCall: jest.Mock; commitRound: jest.Mock; discardPending: jest.Mock; run: jest.Mock };
  let loop: AgenticLoopService;
  let stream: AiReplyStream;

  beforeEach(() => {
    publish = jest.fn().mockResolvedValue(undefined);
    apiStream = jest.fn();
    toolRound = {
      runToolCall: jest.fn(),
      commitRound: jest.fn(),
      discardPending: jest.fn().mockResolvedValue(undefined),
      run: jest.fn(),
    };
    const registry = { getDefinitions: jest.fn().mockResolvedValue([]), execute: jest.fn() };
    loop = new AgenticLoopService(
      config,
      registry as unknown as ToolRegistryService,
      { store: jest.fn() } as unknown as ResponseCacheService,
      { resolveImageBlocks: jest.fn().mockResolvedValue([]) } as unknown as ChatImageService,
      toolRound as unknown as ToolRoundRunner,
    );
    stream = new AiReplyStream({ publish } as unknown as RedisPublisherService, 'conv-1', 'user-1');
  });

  const events = () => publish.mock.calls.map((c) => c[1]);
  const types = () => events().map((e) => e.type);

  async function run(cli: ClaudeCliClient) {
    const state = await loop.prepare(ctx, 'hello', []);
    const promise = loop.runWithFallback({
      anthropic: cli as never,
      fallbackClient: { messages: { stream: apiStream } } as never,
      primaryModel: 'claude-sonnet-4-5',
      fallbackModel: 'claude-haiku-4-5',
      ctx,
      state,
      stream,
      startMs: Date.now(),
    });
    return { state, promise };
  }

  it('answers on the subscription and tallies its usage without touching the API', async () => {
    const runLoop = jest.fn(async (p: { onText: (t: string) => Promise<void> }) => {
      await p.onText('cli answer');
      return cliResult();
    });
    const { state, promise } = await run(makeCli(runLoop));
    const trace = await promise;

    expect(apiStream).not.toHaveBeenCalled();
    expect(types()).toEqual(['AI_STREAM_CHUNK', 'AI_STREAM_DONE']);
    expect(events()[1].fullContent).toBe('cli answer');
    expect(trace).toMatchObject({ model: 'claude-sonnet-4-5', inputTokens: 100, outputTokens: 20 });
    expect(state.thinkingBlocks).toEqual(['pondering']);
    expect(state.thinkingMode).toBe(false);
    expect(runLoop.mock.calls[0][0]).toMatchObject({ system: 'You are PON AI.', maxTurns: expect.any(Number) });
  });

  it('continues on the API fallback when the CLI fails before streaming any text', async () => {
    const runLoop = jest.fn().mockRejectedValue(new Error('subscription quota exhausted'));
    apiStream.mockReturnValue(apiTextTurn('api answer'));
    const { promise } = await run(makeCli(runLoop));
    const trace = await promise;

    expect(apiStream).toHaveBeenCalledTimes(1);
    expect(apiStream.mock.calls[0][0].model).toBe('claude-haiku-4-5');
    expect(types()).toEqual(['AI_STREAM_CHUNK', 'AI_STREAM_DONE']);
    expect(events()[1].fullContent).toBe('api answer');
    expect(trace.model).toBe('claude-haiku-4-5');
    expect(toolRound.discardPending).not.toHaveBeenCalled();
  });

  it('does NOT fall back after text was streamed: publishes AI_STREAM_INTERRUPTED once and rethrows', async () => {
    const runLoop = jest.fn(async (p: { onText: (t: string) => Promise<void> }) => {
      await p.onText('partial');
      throw new Error('cli crashed');
    });
    const { state, promise } = await run(makeCli(runLoop));

    await expect(promise).rejects.toThrow();
    expect(apiStream).not.toHaveBeenCalled();
    expect(types()).toEqual(['AI_STREAM_CHUNK', 'AI_STREAM_ERROR']);
    expect(events()[1]).toMatchObject({
      code: 'AI_STREAM_INTERRUPTED',
      error: 'AI stream was interrupted. Please try again.',
    });
    expect(toolRound.discardPending).toHaveBeenCalledWith(state);
  });

  it('publishes AI_UNAVAILABLE (and drops pending actions) when the API fallback fails too', async () => {
    const runLoop = jest.fn().mockRejectedValue(new Error('cli down'));
    apiStream.mockReturnValue(apiFailingTurn(new Error('529 overloaded')));
    const { state, promise } = await run(makeCli(runLoop));

    await expect(promise).rejects.toThrow('529 overloaded');
    expect(types()).toEqual(['AI_STREAM_ERROR']);
    expect(events()[0]).toMatchObject({ code: 'AI_UNAVAILABLE', error: 'AI is temporarily unavailable.' });
    expect(toolRound.discardPending).toHaveBeenCalledWith(state);
  });

  it('publishes AI_STREAM_INTERRUPTED when the fallback fails mid-stream', async () => {
    const runLoop = jest.fn().mockRejectedValue(new Error('cli down'));
    apiStream.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'half' } };
        throw new Error('socket reset');
      },
      finalMessage: jest.fn(),
    });
    const { promise } = await run(makeCli(runLoop));

    await expect(promise).rejects.toThrow();
    expect(types()).toEqual(['AI_STREAM_CHUNK', 'AI_STREAM_ERROR']);
    expect(events()[1].code).toBe('AI_STREAM_INTERRUPTED');
  });

  it('never generates a second answer when publishing DONE fails', async () => {
    publish.mockImplementation((_c: string, e: { type: string }) =>
      e.type === 'AI_STREAM_DONE' ? Promise.reject(new Error('redis down')) : Promise.resolve(),
    );
    const runLoop = jest.fn().mockResolvedValue(cliResult());
    const { promise } = await run(makeCli(runLoop));

    await expect(promise).rejects.toThrow();
    expect(apiStream).not.toHaveBeenCalled();
    expect(runLoop).toHaveBeenCalledTimes(1);
  });

  it('routes CLI tool calls through the tool runner, stringifying non-string results', async () => {
    toolRound.runToolCall
      .mockResolvedValueOnce({ content: 'plain' })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'x' }] })
      .mockResolvedValueOnce({});
    const outputs: string[] = [];
    const runLoop = jest.fn(async (p: {
      onToolCall: (b: unknown) => Promise<string>;
      onRound: (a: unknown[], r: unknown[]) => void;
    }) => {
      outputs.push(await p.onToolCall({ id: 't1', name: 'a', input: {} }));
      outputs.push(await p.onToolCall({ id: 't2', name: 'b', input: {} }));
      outputs.push(await p.onToolCall({ id: 't3', name: 'c', input: {} }));
      p.onRound([{ type: 'text', text: 'x' }], []);
      return cliResult();
    });
    const { state, promise } = await run(makeCli(runLoop));
    await promise;

    expect(outputs).toEqual(['plain', '[{"type":"text","text":"x"}]', '""']);
    expect(toolRound.runToolCall).toHaveBeenCalledWith({ id: 't1', name: 'a', input: {} }, state, stream);
    expect(toolRound.commitRound).toHaveBeenCalledWith([{ type: 'text', text: 'x' }], [], state);
  });

  it('reports an empty CLI reply as AI_EMPTY_RESPONSE, not a blank DONE', async () => {
    const runLoop = jest.fn().mockResolvedValue(cliResult({ text: '', stopReason: 'refusal' }));
    const { promise } = await run(makeCli(runLoop));
    await promise;
    expect(events()).toEqual([
      expect.objectContaining({ type: 'AI_STREAM_ERROR', code: 'AI_EMPTY_RESPONSE', stopReason: 'refusal' }),
    ]);
  });
});
