import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import {
  AnthropicRequest,
  buildMessage,
  OpenAiUsage,
  toOpenAiRequest,
} from './openrouter-translate';

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
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
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
    stream: (params) => new OpenRouterStream((body) => this.post(body), params),
  };

  constructor(private readonly opts: OpenRouterOptions) {}

  private async create(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    const res = await this.post({
      ...toOpenAiRequest(params as AnthropicRequest),
      stream: false,
    });
    const json = (await res.json()) as OpenAiChunk;
    if (json.error)
      throw new OpenRouterError(json.error.code ?? 502, json.error.message ?? 'error');
    const choice = json.choices?.[0];
    const toolCalls = (choice?.message?.tool_calls ?? []).map((tc, i) => ({
      id: tc.id || `call_${i}_${randomUUID().slice(0, 8)}`,
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

  private async post(body: Record<string, unknown>): Promise<Response> {
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
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 120_000),
    });
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
    private readonly post: (body: Record<string, unknown>) => Promise<Response>,
    private readonly params: Anthropic.MessageStreamParams,
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
    try {
      const res = await this.post({
        ...toOpenAiRequest(this.params as AnthropicRequest),
        stream: true,
        stream_options: { include_usage: true },
      });
      for await (const chunk of sseChunks(res)) {
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
    if (chunk.error)
      throw new OpenRouterError(chunk.error.code ?? 502, chunk.error.message ?? 'error');
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
        if (tc.id) current.id = tc.id;
        if (tc.function?.name) current.name += tc.function.name;
        if (tc.function?.arguments) current.arguments += tc.function.arguments;
        if (!current.id) current.id = `call_${index}_${randomUUID().slice(0, 8)}`;
        this.toolCalls.set(index, current);
      }
      if (choice.finish_reason) this.finish = choice.finish_reason;
    }
    return events;
  }
}

/** Parse an SSE body into JSON chunks; skips `: comment` keep-alives and stops at [DONE]. */
async function* sseChunks(res: Response): AsyncGenerator<OpenAiChunk> {
  if (!res.body) return;
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(part, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      if (!data) continue;
      yield JSON.parse(data) as OpenAiChunk;
    }
  }
}
