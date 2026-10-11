import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import {
  AnthropicRequest,
  buildMessage,
  OpenAiChatRequest,
  OpenAiUsage,
  toOpenAiRequest,
  toolUseId,
} from './openrouter-translate';

/**
 * Statuses that mean "skip OpenRouter for a while", not "retry the next turn":
 * limits (429), no credits (402), model gone (404), provider down (502 / 503).
 */
const UNAVAILABLE_STATUSES = new Set([402, 404, 429, 502, 503]);

/**
 * Below the clients' 30 s "AI is not answering" watchdogs (web
 * AI_STREAM_WATCHDOG_MS, Flutter responseTimeout), so a silent model falls back
 * to Claude before the client gives up on the bubble.
 */
const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = 20_000;
const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

/**
 * Light-tier models may reason before answering and count those tokens as output,
 * so a tiny budget (session titles ask for 32) can end with no text at all. The
 * light tier is cheap or free, so every call gets at least this much room.
 */
const MIN_OUTPUT_TOKENS = 1024;

function withOutputFloor(request: OpenAiChatRequest): OpenAiChatRequest {
  return { ...request, max_tokens: Math.max(request.max_tokens ?? 0, MIN_OUTPUT_TOKENS) };
}

/** What ai-service needs from a model client — the Anthropic SDK shape it already uses. */
export interface LlmMessageStream extends AsyncIterable<Anthropic.RawMessageStreamEvent> {
  finalMessage(): Promise<Anthropic.Message>;
}

export interface LlmClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
    stream(params: Anthropic.MessageStreamParams): LlmMessageStream;
  };
}

export interface OpenRouterOptions {
  apiKey: string;
  baseUrl: string;
  /** Sent as HTTP-Referer / X-Title so the OpenRouter dashboard names the app. */
  appUrl?: string;
  appTitle?: string;
  /** Whole-request limit of a non-streaming call. */
  timeoutMs?: number;
  /** Streaming: give up when no answer data arrives this long after the request (keep-alives do not count). */
  firstTokenTimeoutMs?: number;
  /** Streaming: give up when an answer stops for this long. */
  idleTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * Called when OpenRouter cannot serve the light tier for a while: 429 (free-model
   * daily/minute limits, upstream congestion), 402 (no credits), 404 (model removed).
   */
  onUnavailable?: () => void;
}

/** HTTP failure from OpenRouter. The body excerpt never contains the API key. */
export class OpenRouterError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`OpenRouter ${status}: ${detail.slice(0, 300)}`);
    this.name = 'OpenRouterError';
  }
}

interface OpenAiChunk {
  id?: string;
  error?: { message?: string; code?: number };
  usage?: OpenAiUsage;
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
}

/**
 * OpenRouter behind the Anthropic SDK's `messages.create` / `messages.stream`
 * surface (see openrouter-translate.ts), so any ai-service call site can take
 * it in place of the Anthropic client.
 */
export class OpenRouterClient implements LlmClient {
  readonly messages: LlmClient['messages'] = {
    create: (params) => this.create(params),
    stream: (params) =>
      new OpenRouterStream(
        (body, signal) => this.post(body, signal),
        params,
        this.opts.onUnavailable,
        {
          firstTokenMs: this.opts.firstTokenTimeoutMs ?? DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
          idleMs: this.opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
        },
      ),
  };

  constructor(private readonly opts: OpenRouterOptions) {}

  private async create(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    const res = await this.post(
      { ...withOutputFloor(toOpenAiRequest(params as AnthropicRequest)), stream: false },
      AbortSignal.timeout(this.opts.timeoutMs ?? 120_000),
    );
    const json = (await res.json()) as OpenAiChunk;
    if (json.error) {
      if (UNAVAILABLE_STATUSES.has(json.error.code ?? 0)) this.opts.onUnavailable?.();
      throw new OpenRouterError(json.error.code ?? 502, json.error.message ?? 'error');
    }
    const choice = json.choices?.[0];
    const toolCalls = (choice?.message?.tool_calls ?? []).map((tc, i) => ({
      id: toolUseId(tc.id, i),
      name: tc.function?.name ?? '',
      arguments: tc.function?.arguments ?? '',
    }));
    return buildMessage(
      json.id ?? `or_${randomUUID()}`,
      params.model,
      choice?.message?.content ?? '',
      toolCalls,
      choice?.finish_reason,
      json.usage,
    );
  }

  private async post(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const res = await fetchImpl(`${this.opts.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
        ...(this.opts.appUrl ? { 'HTTP-Referer': this.opts.appUrl } : {}),
        ...(this.opts.appTitle ? { 'X-Title': this.opts.appTitle } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    if (UNAVAILABLE_STATUSES.has(res.status)) this.opts.onUnavailable?.();
    if (!res.ok) throw new OpenRouterError(res.status, await res.text().catch(() => ''));
    return res;
  }
}

/**
 * One streamed completion, replayed as the Anthropic events the agentic loop
 * reads (text block start / delta / stop). Tool-call fragments are joined by
 * index and surface as `tool_use` blocks on `finalMessage()`.
 */
export class OpenRouterStream implements LlmMessageStream {
  private text = '';
  private textOpen = false;
  private readonly toolCalls = new Map<number, { id: string; name: string; arguments: string }>();
  private finish: string | null = null;
  private usage: OpenAiUsage | undefined;
  private id = `or_${randomUUID()}`;
  private consumed: Promise<void> | null = null;
  private readonly buffered: Anthropic.RawMessageStreamEvent[] = [];

  constructor(
    private readonly post: (body: Record<string, unknown>, signal: AbortSignal) => Promise<Response>,
    private readonly params: Anthropic.MessageStreamParams,
    private readonly onUnavailable?: () => void,
    private readonly timeouts: StreamTimeouts = {
      firstTokenMs: DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
      idleMs: DEFAULT_IDLE_TIMEOUT_MS,
    },
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<Anthropic.RawMessageStreamEvent> {
    if (this.consumed) throw new Error('OpenRouterStream can only be iterated once');
    let resolveDone!: () => void;
    let rejectDone!: (e: unknown) => void;
    this.consumed = new Promise<void>((res, rej) => {
      resolveDone = res;
      rejectDone = rej;
    });
    this.consumed.catch(() => undefined);
    // No total limit: a long answer may stream for minutes. What is limited is
    // the wait for the first answer data and any stall after it.
    const watchdog = new StreamWatchdog(this.timeouts);
    try {
      const res = await watchdog.guard(
        this.post(
          {
            ...withOutputFloor(toOpenAiRequest(this.params as AnthropicRequest)),
            stream: true,
            stream_options: { include_usage: true },
          },
          watchdog.signal,
        ),
      );
      for await (const chunk of sseChunks(res, watchdog)) {
        for (const event of this.apply(chunk)) yield event;
      }
      if (this.textOpen)
        yield {
          type: 'content_block_stop',
          index: 0,
        } as Anthropic.RawMessageStreamEvent;
      resolveDone();
    } catch (err) {
      rejectDone(err);
      throw err;
    } finally {
      watchdog.stop();
    }
  }

  async finalMessage(): Promise<Anthropic.Message> {
    if (!this.consumed) {
      for await (const event of this) this.buffered.push(event);
    }
    await this.consumed;
    const toolCalls = [...this.toolCalls.entries()].sort(([a], [b]) => a - b).map(([, tc]) => tc);
    return buildMessage(this.id, this.params.model, this.text, toolCalls, this.finish, this.usage);
  }

  private apply(chunk: OpenAiChunk): Anthropic.RawMessageStreamEvent[] {
    if (chunk.error) {
      if (UNAVAILABLE_STATUSES.has(chunk.error.code ?? 0)) this.onUnavailable?.();
      throw new OpenRouterError(chunk.error.code ?? 502, chunk.error.message ?? 'error');
    }
    if (chunk.id) this.id = chunk.id;
    if (chunk.usage) this.usage = chunk.usage;
    const events: Anthropic.RawMessageStreamEvent[] = [];
    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta ?? {};
      if (typeof delta.content === 'string' && delta.content) {
        if (!this.textOpen) {
          this.textOpen = true;
          events.push({
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '', citations: null },
          } as Anthropic.RawMessageStreamEvent);
        }
        this.text += delta.content;
        events.push({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: delta.content },
        } as Anthropic.RawMessageStreamEvent);
      }
      for (const tc of delta.tool_calls ?? []) {
        const index = tc.index ?? 0;
        const current = this.toolCalls.get(index) ?? {
          id: '',
          name: '',
          arguments: '',
        };
        if (tc.id && !current.id) current.id = toolUseId(tc.id, index);
        if (tc.function?.name) current.name += tc.function.name;
        if (tc.function?.arguments) current.arguments += tc.function.arguments;
        if (!current.id) current.id = toolUseId(undefined, index);
        this.toolCalls.set(index, current);
      }
      if (choice.finish_reason) this.finish = choice.finish_reason;
    }
    return events;
  }
}

interface StreamTimeouts {
  firstTokenMs: number;
  idleMs: number;
}

/**
 * Aborts a streamed request when no answer data arrives within `firstTokenMs`
 * (SSE keep-alive comments do not count) or the answer stalls for `idleMs`.
 */
class StreamWatchdog {
  private readonly controller = new AbortController();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly expiredPromise: Promise<never>;
  private rejectExpired!: (err: OpenRouterError) => void;

  constructor(private readonly timeouts: StreamTimeouts) {
    this.expiredPromise = new Promise<never>((_, reject) => {
      this.rejectExpired = reject;
    });
    this.expiredPromise.catch(() => undefined);
    this.arm(timeouts.firstTokenMs, `no answer within ${timeouts.firstTokenMs} ms`);
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** Answer data arrived: from now on only a stall counts. */
  progress(): void {
    this.arm(this.timeouts.idleMs, `stream stalled for ${this.timeouts.idleMs} ms`);
  }

  /** Resolve `work`, or fail as soon as the watchdog fires. */
  guard<T>(work: Promise<T>): Promise<T> {
    return Promise.race([work, this.expiredPromise]);
  }

  stop(): void {
    clearTimeout(this.timer);
  }

  private arm(ms: number, reason: string): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const err = new OpenRouterError(504, reason);
      this.rejectExpired(err);
      this.controller.abort(err);
    }, ms);
    this.timer.unref?.();
  }
}

/** Parse an SSE body into JSON chunks; skips `: comment` keep-alives and stops at [DONE]. */
async function* sseChunks(res: Response, watchdog: StreamWatchdog): AsyncGenerator<OpenAiChunk> {
  if (!res.body) return;
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await watchdog.guard(reader.read());
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        if (!data) continue;
        watchdog.progress();
        yield JSON.parse(data) as OpenAiChunk;
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}
