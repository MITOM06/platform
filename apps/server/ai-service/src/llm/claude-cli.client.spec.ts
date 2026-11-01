import Anthropic from '@anthropic-ai/sdk';
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
      permissionMode: 'bypassPermissions',
      settingSources: [],
      persistSession: false,
      includePartialMessages: true,
      thinking: { type: 'disabled' },
    });
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
