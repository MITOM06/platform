import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import os from 'os';
import { z, ZodRawShape, ZodTypeAny } from 'zod';

type MutableShape = Record<string, ZodTypeAny>;
import { TokenCounts, countTokens } from '../usage/token-counts';
import { AgentSdkLoader, loadAgentSdk } from './claude-cli.sdk-loader';

/**
 * Chat replies on the owner's Claude Code subscription instead of the API.
 *
 * One `query()` of the Agent SDK per reply: it spawns the Claude Code runtime
 * signed in with `CLAUDE_CODE_OAUTH_TOKEN` (or the credentials in the CLI
 * home), gives it PON's system prompt, the session transcript and PON's tools
 * as an in-process MCP server, and streams the text back. Tool calls come back
 * into ai-service through `onToolCall` (the ordinary `ToolRoundRunner` path),
 * and every completed round is mirrored into the loop state through `onRound`
 * so an API continuation after a CLI failure never re-runs a tool.
 *
 * Off unless `AI_PROVIDER=claude-cli` (see `fromConfig`).
 */
export interface ClaudeCliOptions {
  /** Token from `claude setup-token`; without it the CLI reads `<home>/.claude`. */
  oauthToken?: string;
  /** Abort a reply after this long. */
  timeoutMs: number;
  /** HOME of the CLI subprocess (its config + credentials live there). */
  home: string;
  /** Optional path to the Claude Code executable (default: the SDK's native binary). */
  executablePath?: string;
}

export interface CliToolSpec {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface CliLoopParams {
  model: string;
  system: string;
  /** The loop's message list: history + the new user turn (+ mirrored rounds). */
  messages: Anthropic.MessageParam[];
  tools: CliToolSpec[];
  thinking: boolean;
  /** Tool rounds the CLI may still run (PON's MAX_ITER budget). */
  maxTurns: number;
  onText(delta: string): Promise<void>;
  /** Runs one tool call (PON name + input); returns the tool_result text. */
  onToolCall(block: Anthropic.ToolUseBlock): Promise<string>;
  /** A completed round: assistant content (PON tool names) + its tool results. */
  onRound(assistant: Anthropic.ContentBlockParam[], results: Anthropic.ToolResultBlockParam[]): void;
}

export interface CliLoopResult {
  text: string;
  usage: TokenCounts;
  stopReason: string | null;
  numTurns: number;
  costUsd: number;
  thinkingBlocks: string[];
}

export class ClaudeCliError extends Error {
  constructor(message: string) {
    super(`Claude CLI: ${message}`);
    this.name = 'ClaudeCliError';
  }
}

const MCP_SERVER = 'pon';
/** PON connector tools are `mcp__<provider>__<tool>`; the CLI prefixes MCP tools itself. */
export function toMcpToolName(name: string): string {
  return name.startsWith('mcp__') ? `ext__${name.slice(5)}` : name;
}
const MCP_PREFIX = `mcp__${MCP_SERVER}__`;
export function fromMcpToolName(name: string): string {
  const bare = name.startsWith(MCP_PREFIX) ? name.slice(MCP_PREFIX.length) : name;
  return bare.startsWith('ext__') ? `mcp__${bare.slice(5)}` : bare;
}

type JsonSchema = {
  type?: string;
  description?: string;
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
};

function toZod(schema: JsonSchema): ZodTypeAny {
  let t: ZodTypeAny;
  switch (schema.type) {
    case 'string':
      t = schema.enum?.length ? z.enum(schema.enum as [string, ...string[]]) : z.string();
      break;
    case 'number':
    case 'integer':
      t = z.number();
      break;
    case 'boolean':
      t = z.boolean();
      break;
    case 'array':
      t = z.array(toZod(schema.items ?? {}));
      break;
    case 'object':
      t = schema.properties ? z.object(toZodShape(schema)) : z.record(z.string(), z.any());
      break;
    default:
      t = z.any();
  }
  return schema.description ? t.describe(schema.description) : t;
}

/** Anthropic tool `input_schema` → zod shape the Agent SDK's `tool()` takes. */
export function toZodShape(schema: JsonSchema): ZodRawShape {
  const required = new Set(schema.required ?? []);
  const shape: MutableShape = {};
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    const t = toZod(prop);
    shape[key] = required.has(key) ? t : t.optional();
  }
  return shape as ZodRawShape;
}

function blockText(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((b) => {
      switch (b.type) {
        case 'text':
          return b.text;
        case 'tool_use':
          return `[gọi tool ${b.name}(${JSON.stringify(b.input ?? {})})]`;
        case 'tool_result': {
          const c = b.content;
          const text =
            typeof c === 'string' ? c : (c ?? []).map((x) => (x.type === 'text' ? x.text : '')).join('');
          return `[kết quả tool: ${text}]`;
        }
        case 'image':
          return '[ảnh]';
        default:
          return '';
      }
    })
    .filter((s) => s.trim())
    .join('\n');
}

/**
 * The CLI takes one prompt string: earlier turns are rendered as a transcript
 * the model must not answer again, followed by the new user message.
 */
export function renderPrompt(messages: Anthropic.MessageParam[]): string {
  if (messages.length === 0) return '';
  const last = messages[messages.length - 1];
  const current = blockText(last.content);
  const history = messages.slice(0, -1);
  if (history.length === 0) return current;
  const lines = history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${blockText(m.content)}`);
  return (
    'Lịch sử hội thoại gần đây (chỉ để nắm ngữ cảnh, KHÔNG trả lời lại các tin này):\n' +
    `<history>\n${lines.join('\n')}\n</history>\n\n` +
    `Tin nhắn mới của người dùng:\n${current}`
  );
}

type StreamEvent = { type: string; delta?: { type?: string; text?: string } };

export class ClaudeCliClient {
  private readonly logger = new Logger(ClaudeCliClient.name);

  constructor(
    readonly options: ClaudeCliOptions,
    private readonly loadSdk: AgentSdkLoader = loadAgentSdk,
  ) {}

  /** The client when `AI_PROVIDER=claude-cli`, otherwise null (nothing changes). */
  static fromConfig(config: ConfigService): ClaudeCliClient | null {
    if (config.get<string>('config.ai.provider') !== 'claude-cli') return null;
    const cli = config.get<Partial<ClaudeCliOptions>>('config.ai.claudeCli') ?? {};
    const client = new ClaudeCliClient({
      oauthToken: cli.oauthToken,
      timeoutMs: cli.timeoutMs ?? 120_000,
      home: cli.home || os.homedir(),
      executablePath: cli.executablePath,
    });
    client.logger.log(
      `Chat replies on the Claude Code subscription (${cli.oauthToken ? 'CLAUDE_CODE_OAUTH_TOKEN' : `credentials in ${client.options.home}`}); the API is the fallback`,
    );
    return client;
  }

  /** Subprocess env: never the API key (the CLI would bill it instead of the plan). */
  subprocessEnv(): Record<string, string | undefined> {
    return {
      PATH: process.env.PATH,
      HOME: this.options.home,
      TMPDIR: process.env.TMPDIR,
      LANG: process.env.LANG || 'C.UTF-8',
      DISABLE_AUTOUPDATER: '1',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      ...(this.options.oauthToken ? { CLAUDE_CODE_OAUTH_TOKEN: this.options.oauthToken } : {}),
    };
  }

  /**
   * The CLI runs with HOME and cwd at `options.home`. In the container that is
   * a fresh path (CLAUDE_CLI_HOME): spawning into a missing cwd fails with
   * ENOENT, which the SDK reports as "binary exists but failed to launch".
   */
  private ensureHome(): void {
    try {
      mkdirSync(this.options.home, { recursive: true });
    } catch (err) {
      throw new ClaudeCliError(`cannot create ${this.options.home}: ${(err as Error).message}`);
    }
  }

  async runLoop(p: CliLoopParams): Promise<CliLoopResult> {
    this.ensureHome();
    const sdk = await this.loadSdk();
    const tools = p.tools.map((t) =>
      sdk.tool(toMcpToolName(t.name), t.description, toZodShape(t.input_schema), async (args) => {
        const block = {
          type: 'tool_use',
          id: `toolu_cli_${randomUUID()}`,
          name: t.name,
          input: args ?? {},
        } as Anthropic.ToolUseBlock;
        const text = await p.onToolCall(block);
        return { content: [{ type: 'text', text: text || '(no output)' }] };
      }),
    );
    const server = sdk.createSdkMcpServer({ name: MCP_SERVER, version: '1.0.0', tools });
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.options.timeoutMs);
    const options: Options = {
      systemPrompt: p.system,
      model: p.model,
      tools: [],
      mcpServers: { [MCP_SERVER]: server },
      allowedTools: p.tools.map((t) => `mcp__${MCP_SERVER}__${toMcpToolName(t.name)}`),
      // Not `bypassPermissions`: Claude Code refuses --dangerously-skip-permissions
      // when it runs as root, which it does in the container. Nothing needs it:
      // the built-in tools are off and every PON tool is in `allowedTools`.
      permissionMode: 'default',
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      includePartialMessages: true,
      maxTurns: Math.max(1, p.maxTurns),
      thinking: p.thinking ? { type: 'adaptive' } : { type: 'disabled' },
      env: this.subprocessEnv(),
      cwd: this.options.home,
      abortController: abort,
      ...(this.options.executablePath ? { pathToClaudeCodeExecutable: this.options.executablePath } : {}),
      stderr: (data: string) => this.logger.debug(`cli: ${data.trim()}`),
    };

    const mirror = new RoundMirror(p.onRound);
    let streamed = '';
    let assistantText = '';
    const thinkingBlocks: string[] = [];
    let result: CliLoopResult | null = null;
    try {
      for await (const m of sdk.query({ prompt: renderPrompt(p.messages), options }) as AsyncIterable<SDKMessage>) {
        if (m.type === 'stream_event') {
          if (m.parent_tool_use_id !== null) continue;
          const e = m.event as StreamEvent;
          if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) {
            streamed += e.delta.text;
            await p.onText(e.delta.text);
          }
        } else if (m.type === 'assistant') {
          if (m.parent_tool_use_id !== null) continue;
          for (const b of m.message.content as Anthropic.ContentBlock[]) {
            if (b.type === 'text') assistantText = assistantText ? `${assistantText}\n${b.text}` : b.text;
            if (b.type === 'thinking' && b.thinking) thinkingBlocks.push(b.thinking);
          }
          mirror.assistant(m.message.content as Anthropic.ContentBlock[]);
        } else if (m.type === 'user') {
          if (m.parent_tool_use_id !== null) continue;
          mirror.user(m.message.content);
        } else if (m.type === 'result') {
          const usage = countTokens(m.usage as Parameters<typeof countTokens>[0]);
          if (m.subtype !== 'success') {
            const errors = 'errors' in m && Array.isArray(m.errors) ? m.errors.join('; ') : '';
            throw new ClaudeCliError(`${m.subtype}${errors ? ` — ${errors}` : ''}`);
          }
          result = {
            text: streamed || assistantText,
            usage,
            stopReason: m.stop_reason ?? null,
            numTurns: m.num_turns,
            costUsd: m.total_cost_usd ?? 0,
            thinkingBlocks,
          };
        }
      }
    } catch (err) {
      if (abort.signal.aborted) throw new ClaudeCliError(`timed out after ${this.options.timeoutMs} ms`);
      throw err instanceof ClaudeCliError ? err : new ClaudeCliError((err as Error).message);
    } finally {
      clearTimeout(timer);
      mirror.flush();
    }
    if (!result) throw new ClaudeCliError('ended without a result');
    if (!streamed && assistantText) await p.onText(assistantText);
    return result;
  }
}

/**
 * Rebuilds PON-shaped rounds from the SDK's message stream: assistant blocks
 * (the SDK may split one turn into several messages) up to the tool results
 * that answer them. Thinking blocks are dropped (an API continuation runs
 * without thinking) and tool names are mapped back to PON's.
 */
class RoundMirror {
  private assistantBlocks: Anthropic.ContentBlockParam[] = [];
  private results: Anthropic.ToolResultBlockParam[] = [];

  constructor(private readonly onRound: CliLoopParams['onRound']) {}

  assistant(content: Anthropic.ContentBlock[]): void {
    if (this.results.length > 0) this.flush();
    for (const b of content) {
      if (b.type === 'text') this.assistantBlocks.push({ type: 'text', text: b.text });
      else if (b.type === 'tool_use') {
        this.assistantBlocks.push({ type: 'tool_use', id: b.id, name: fromMcpToolName(b.name), input: b.input });
      }
    }
  }

  user(content: Anthropic.MessageParam['content']): void {
    if (typeof content === 'string') return;
    for (const b of content) if (b.type === 'tool_result') this.results.push(b);
  }

  /** Commit the round when it has tool results (a final text-only turn is not a round). */
  flush(): void {
    if (this.results.length > 0 && this.assistantBlocks.some((b) => b.type === 'tool_use')) {
      this.onRound(this.assistantBlocks, this.results);
    }
    this.assistantBlocks = [];
    this.results = [];
  }
}
