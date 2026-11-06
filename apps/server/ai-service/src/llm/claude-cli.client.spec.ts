import Anthropic from '@anthropic-ai/sdk';
import { existsSync, mkdtempSync } from 'fs';
import os from 'os';
import path from 'path';
import { ConfigService } from '@nestjs/config';
import {
  ClaudeCliClient,
  ClaudeCliError,
  fromMcpToolName,
  renderPrompt,
  toMcpToolName,
  toZodShape,
} from './claude-cli.client';
import type { AgentSdk } from './claude-cli.sdk-loader';

type Handler = (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>;

/** A fake Agent SDK: records the query options and plays a scripted message stream. */
function fakeSdk(script: (handlers: Map<string, Handler>, options: Record<string, unknown>) => AsyncGenerator<unknown>) {
  const handlers = new Map<string, Handler>();
  const seen: { options?: Record<string, unknown>; prompt?: string } = {};
  const sdk = {
    tool: (name: string, description: string, inputSchema: unknown, handler: Handler) => {
      handlers.set(name, handler);
      return { name, description, inputSchema, handler };
    },
    createSdkMcpServer: (o: { name: string; tools?: unknown[] }) => ({ type: 'sdk', name: o.name, instance: { tools: o.tools } }),
    query: ({ prompt, options }: { prompt: string; options: Record<string, unknown> }) => {
      seen.prompt = prompt;
      seen.options = options;
      return script(handlers, options);
    },
  } as unknown as AgentSdk;
  return { sdk, seen, handlers };
}

const delta = (text: string) => ({
  type: 'stream_event',
  parent_tool_use_id: null,
  event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
});
const assistant = (content: unknown[]) => ({ type: 'assistant', parent_tool_use_id: null, message: { content } });
const user = (content: unknown[]) => ({ type: 'user', parent_tool_use_id: null, message: { content } });
const success = (over: Record<string, unknown> = {}) => ({
  type: 'result',
  subtype: 'success',
  is_error: false,
  num_turns: 2,
  stop_reason: 'end_turn',
  total_cost_usd: 0.01,
  usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 5, cache_read_input_tokens: 0 },
  ...over,
});

const KB_TOOL = {
  name: 'search_knowledge_base',
  description: 'Search the KB',
  input_schema: { type: 'object' as const, properties: { query: { type: 'string', description: 'q' } }, required: ['query'] },
};
const MAIL_TOOL = {
  name: 'mcp__google__send_email',
  description: 'Send mail',
  input_schema: { type: 'object' as const, properties: { to: { type: 'string' } }, required: ['to'] },
};

function client(sdk: AgentSdk, over: Partial<ConstructorParameters<typeof ClaudeCliClient>[0]> = {}) {
  return new ClaudeCliClient({ timeoutMs: 5_000, home: '/tmp/pon-cli-home', oauthToken: 'sk-ant-oat-test', ...over }, async () => sdk);
}

describe('ClaudeCliClient.runLoop', () => {
  it('streams text, bridges a tool call through onToolCall and mirrors the round with PON names', async () => {
    const { sdk, seen } = fakeSdk(async function* (handlers) {
      yield { type: 'system', subtype: 'init' };
      const r = await handlers.get('search_knowledge_base')!({ query: 'T1 buffer' }, {});
      yield assistant([{ type: 'tool_use', id: 'toolu_1', name: 'mcp__pon__search_knowledge_base', input: { query: 'T1 buffer' } }]);
      yield user([{ type: 'tool_result', tool_use_id: 'toolu_1', content: r.content[0].text }]);
      yield delta('2 giờ');
      yield delta(' (720 bản tin).');
      yield assistant([{ type: 'text', text: '2 giờ (720 bản tin).' }]);
      yield success();
    });
    const text: string[] = [];
    const calls: Anthropic.ToolUseBlock[] = [];
    const rounds: Array<[Anthropic.ContentBlockParam[], Anthropic.ToolResultBlockParam[]]> = [];
    const result = await client(sdk).runLoop({
      model: 'claude-sonnet-4-5',
      system: 'SYS',
      messages: [{ role: 'user', content: 'T1 lưu đệm bao lâu?' }],
      tools: [KB_TOOL],
      thinking: false,
      maxTurns: 6,
      onText: async (d) => void text.push(d),
      onToolCall: async (b) => {
        calls.push(b);
        return 'Lumen-T1 lưu đệm 2 giờ';
      },
      onRound: (a, r) => void rounds.push([a, r]),
    });

    expect(text).toEqual(['2 giờ', ' (720 bản tin).']);
    expect(result.text).toBe('2 giờ (720 bản tin).');
    expect(result.usage).toEqual({ inputTokens: 15, outputTokens: 20, cacheCreationInputTokens: 5, cacheReadInputTokens: 0 });
    expect(result.numTurns).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ type: 'tool_use', name: 'search_knowledge_base', input: { query: 'T1 buffer' } });
    // The round reaches the loop state with PON tool names and the tool's own text.
    expect(rounds).toHaveLength(1);
    expect(rounds[0][0]).toEqual([{ type: 'tool_use', id: 'toolu_1', name: 'search_knowledge_base', input: { query: 'T1 buffer' } }]);
    expect(rounds[0][1]).toEqual([{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'Lumen-T1 lưu đệm 2 giờ' }]);
    // Query options: PON's prompt + tools only, subscription env, no API key.
    expect(seen.prompt).toBe('T1 lưu đệm bao lâu?');
    expect(seen.options).toMatchObject({
      systemPrompt: 'SYS',
      model: 'claude-sonnet-4-5',
      tools: [],
      allowedTools: ['mcp__pon__search_knowledge_base'],
      permissionMode: 'default',
      settingSources: [],
      persistSession: false,
      includePartialMessages: true,
      thinking: { type: 'disabled' },
    });
    expect(seen.options!.allowDangerouslySkipPermissions).toBeUndefined();
    const env = seen.options!.env as Record<string, string>;
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe('sk-ant-oat-test');
    expect(env.HOME).toBe('/tmp/pon-cli-home');
    expect('ANTHROPIC_API_KEY' in env).toBe(false);
  });

  it('uses the assistant text when no deltas were streamed', async () => {
    const { sdk } = fakeSdk(async function* () {
      yield assistant([{ type: 'text', text: 'Xin chào.' }]);
      yield success({ num_turns: 1 });
    });
    const text: string[] = [];
    const result = await client(sdk).runLoop({
      model: 'claude-haiku-4-5', system: '', messages: [{ role: 'user', content: 'hi' }], tools: [], thinking: false, maxTurns: 2,
      onText: async (d) => void text.push(d), onToolCall: async () => '', onRound: () => undefined,
    });
    expect(result.text).toBe('Xin chào.');
    expect(text).toEqual(['Xin chào.']);
  });

  it('throws a ClaudeCliError when the SDK result is not a success (so the loop falls back to the API)', async () => {
    const { sdk } = fakeSdk(async function* () {
      yield success({ subtype: 'error_during_execution', is_error: true, errors: ['rate limit reached'] });
    });
    await expect(
      client(sdk).runLoop({
        model: 'claude-sonnet-4-5', system: '', messages: [{ role: 'user', content: 'hi' }], tools: [], thinking: false, maxTurns: 2,
        onText: async () => undefined, onToolCall: async () => '', onRound: () => undefined,
      }),
    ).rejects.toThrow(ClaudeCliError);
  });

  it('wraps an SDK exception as ClaudeCliError', async () => {
    const { sdk } = fakeSdk(async function* () {
      yield { type: 'system', subtype: 'init' };
      throw new Error('spawn ENOENT');
    });
    await expect(
      client(sdk).runLoop({
        model: 'claude-sonnet-4-5', system: '', messages: [{ role: 'user', content: 'hi' }], tools: [], thinking: false, maxTurns: 2,
        onText: async () => undefined, onToolCall: async () => '', onRound: () => undefined,
      }),
    ).rejects.toThrow('Claude CLI: spawn ENOENT');
  });

  it('exposes connector tools under a CLI-safe name and maps them back', () => {
    expect(toMcpToolName(MAIL_TOOL.name)).toBe('ext__google__send_email');
    expect(fromMcpToolName('mcp__pon__ext__google__send_email')).toBe('mcp__google__send_email');
    expect(fromMcpToolName('mcp__pon__search_knowledge_base')).toBe('search_knowledge_base');
    expect(fromMcpToolName('create_reminder')).toBe('create_reminder');
  });
});

describe('ClaudeCliClient.fromConfig', () => {
  const cfg = (values: Record<string, unknown>) =>
    ({ get: (k: string) => values[k] }) as unknown as ConfigService;

  it('is null unless AI_PROVIDER=claude-cli', () => {
    expect(ClaudeCliClient.fromConfig(cfg({ 'config.ai.provider': 'api' }))).toBeNull();
    expect(ClaudeCliClient.fromConfig(cfg({}))).toBeNull();
  });

  it('builds the client from config with defaults', () => {
    const c = ClaudeCliClient.fromConfig(
      cfg({ 'config.ai.provider': 'claude-cli', 'config.ai.claudeCli': { oauthToken: 't', home: '/data/home' } }),
    );
    expect(c).not.toBeNull();
    expect(c!.options).toMatchObject({ oauthToken: 't', home: '/data/home', timeoutMs: 120_000 });
  });
});

describe('renderPrompt', () => {
  it('returns the new message alone when there is no history', () => {
    expect(renderPrompt([{ role: 'user', content: 'Hỏi gì đó' }])).toBe('Hỏi gì đó');
  });

  it('renders earlier turns as a transcript the model must not answer again', () => {
    const out = renderPrompt([
      { role: 'user', content: 'A?' },
      { role: 'assistant', content: [{ type: 'text', text: 'B.' }] },
      { role: 'user', content: 'C?' },
    ]);
    expect(out).toContain('<history>\nUser: A?\nAssistant: B.\n</history>');
    expect(out.endsWith('Tin nhắn mới của người dùng:\nC?')).toBe(true);
  });
});

describe('toZodShape', () => {
  it('keeps required / optional and basic types', () => {
    const shape = toZodShape({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'q' },
        limit: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
        mode: { type: 'string', enum: ['a', 'b'] },
      },
      required: ['query'],
    }) as unknown as Record<string, { safeParse(v: unknown): { success: boolean } }>;
    expect(shape.query.safeParse('x').success).toBe(true);
    expect(shape.query.safeParse(undefined).success).toBe(false);
    expect(shape.limit.safeParse(undefined).success).toBe(true);
    expect(shape.limit.safeParse('no').success).toBe(false);
    expect(shape.tags.safeParse(['a']).success).toBe(true);
    expect(shape.mode.safeParse('c').success).toBe(false);
  });
});

describe('ClaudeCliClient home directory', () => {
  it('creates the CLI home (HOME + cwd) before the first query', async () => {
    const home = path.join(mkdtempSync(path.join(os.tmpdir(), 'pon-cli-')), 'nested', 'home');
    const { sdk, seen } = fakeSdk(async function* () {
      yield success({ result: 'ok' });
    });
    expect(existsSync(home)).toBe(false);
    await client(sdk, { home }).runLoop({
      model: 'claude-haiku-4-5', system: '', messages: [{ role: 'user', content: 'hi' }], tools: [], thinking: false, maxTurns: 2,
      onText: async () => undefined, onToolCall: async () => '', onRound: () => undefined,
    });
    expect(existsSync(home)).toBe(true);
    expect((seen.options!.env as Record<string, string>).HOME).toBe(home);
    expect(seen.options!.cwd).toBe(home);
  });
});

describe('ClaudeCliClient.runLoop — failure modes that must hand over to the API', () => {
  const params = (over: Record<string, unknown> = {}) => ({
    model: 'claude-sonnet-4-5', system: '', messages: [{ role: 'user' as const, content: 'hi' }], tools: [], thinking: false, maxTurns: 2,
    onText: async () => undefined, onToolCall: async () => '', onRound: () => undefined, ...over,
  });

  it('throws when the stream ends without a result message', async () => {
    const { sdk } = fakeSdk(async function* () {
      yield assistant([{ type: 'text', text: 'half' }]);
    });
    await expect(client(sdk).runLoop(params())).rejects.toThrow('ended without a result');
  });

  it('reports a timeout (abort) as a ClaudeCliError naming the limit', async () => {
    jest.useFakeTimers({ legacyFakeTimers: true });
    try {
      const { sdk } = fakeSdk(async function* (_h, options) {
        const abort = options.abortController as AbortController;
        await new Promise<void>((resolve) => abort.signal.addEventListener('abort', () => resolve()));
        throw new Error('aborted');
      });
      const run = client(sdk, { timeoutMs: 50 }).runLoop(params());
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(60);
      await expect(run).rejects.toThrow('timed out after 50 ms');
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores sub-agent stream events and messages (parent_tool_use_id set)', async () => {
    const { sdk } = fakeSdk(async function* () {
      yield { ...delta('hidden'), parent_tool_use_id: 'tu-1' };
      yield { ...assistant([{ type: 'text', text: 'hidden too' }]), parent_tool_use_id: 'tu-1' };
      yield { ...user([{ type: 'tool_result', tool_use_id: 'x', content: 'r' }]), parent_tool_use_id: 'tu-1' };
      yield delta('shown');
      yield success();
    });
    const text: string[] = [];
    const rounds: unknown[] = [];
    const r = await client(sdk).runLoop(params({ onText: async (d: string) => void text.push(d), onRound: (a: unknown) => rounds.push(a) }));
    expect(r.text).toBe('shown');
    expect(text).toEqual(['shown']);
    expect(rounds).toEqual([]);
  });

  it('collects thinking blocks and enables adaptive thinking when asked', async () => {
    const { sdk, seen } = fakeSdk(async function* () {
      yield assistant([{ type: 'thinking', thinking: 'hmm' }, { type: 'text', text: 'A' }]);
      yield assistant([{ type: 'text', text: 'B' }]);
      yield success();
    });
    const r = await client(sdk).runLoop(params({ thinking: true }));
    expect(r.thinkingBlocks).toEqual(['hmm']);
    expect(r.text).toBe('A\nB');
    expect(seen.options?.thinking).toEqual({ type: 'adaptive' });
  });

  it('a non-success result without an errors list still throws with its subtype', async () => {
    const { sdk } = fakeSdk(async function* () {
      yield success({ subtype: 'error_max_turns' });
    });
    await expect(client(sdk).runLoop(params())).rejects.toThrow('error_max_turns');
  });
});

describe('renderPrompt — block kinds', () => {
  it('renders tool calls, tool results and images as readable markers', () => {
    const out = renderPrompt([
      { role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'x' } }, { type: 'text', text: 'see' }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'search', input: { q: 1 } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: [{ type: 'text', text: 'found' }] }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't2', content: 'plain' }, { type: 'tool_result', tool_use_id: 't3' }] },
      { role: 'user', content: 'now?' },
    ] as Anthropic.MessageParam[]);
    expect(out).toContain('User: [ảnh]\nsee');
    expect(out).toContain('Assistant: [gọi tool search({"q":1})]');
    expect(out).toContain('User: [kết quả tool: found]');
    expect(out).toContain('User: [kết quả tool: plain]\n[kết quả tool: ]');
    expect(renderPrompt([])).toBe('');
  });
});

describe('toZodShape — remaining types', () => {
  it('maps number, boolean, nested object, free-form object and unknown types', () => {
    const shape = toZodShape({
      type: 'object',
      properties: {
        n: { type: 'number' },
        b: { type: 'boolean' },
        o: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] },
        free: { type: 'object' },
        any: {},
        list: { type: 'array' },
      },
      required: ['n', 'b', 'o', 'free', 'any', 'list'],
    }) as unknown as Record<string, { safeParse(v: unknown): { success: boolean } }>;
    expect(shape.n.safeParse(1.5).success).toBe(true);
    expect(shape.n.safeParse('1').success).toBe(false);
    expect(shape.b.safeParse(true).success).toBe(true);
    expect(shape.b.safeParse('true').success).toBe(false);
    expect(shape.o.safeParse({ x: 'y' }).success).toBe(true);
    expect(shape.o.safeParse({}).success).toBe(false);
    expect(shape.free.safeParse({ k: 1 }).success).toBe(true);
    expect(shape.any.safeParse(42).success).toBe(true);
    expect(shape.list.safeParse([1, 'a']).success).toBe(true);
  });
});
