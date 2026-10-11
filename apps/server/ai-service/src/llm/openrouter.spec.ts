import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { toOpenAiRequest } from './openrouter-translate';
import { OpenRouterClient, OpenRouterError } from './openrouter-client';
import { LlmClientsService } from './llm-clients.service';

/** A fetch Response whose body streams the given SSE lines. */
function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Split mid-line on purpose: SSE frames do not align with network chunks.
      const raw = lines.join('\n') + '\n';
      const cut = Math.floor(raw.length / 2);
      controller.enqueue(encoder.encode(raw.slice(0, cut)));
      controller.enqueue(encoder.encode(raw.slice(cut)));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

const data = (obj: unknown) => `data: ${JSON.stringify(obj)}`;

function client(fetchImpl: jest.Mock) {
  return new OpenRouterClient({ apiKey: 'k', baseUrl: 'https://or.test/api/v1', fetchImpl });
}

describe('toOpenAiRequest', () => {
  it('maps system blocks, tools, tool_use and tool_result turns, images and tool_choice', () => {
    const req = toOpenAiRequest({
      model: 'google/gemini-2.5-flash-lite',
      max_tokens: 100,
      system: [
        { type: 'text', text: 'Base persona', cache_control: { type: 'ephemeral' } },
        { type: 'text', text: 'Volatile context' },
      ],
      tools: [
        {
          name: 'search_kb',
          description: 'Search',
          input_schema: { type: 'object', properties: { q: { type: 'string' } } },
        },
      ],
      tool_choice: { type: 'auto' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } },
            { type: 'text', text: 'What is this?' },
          ],
        },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me look.' },
            { type: 'tool_use', id: 'tu_1', name: 'search_kb', input: { q: 'x' } },
          ],
        },
        {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tu_1', content: 'found it', is_error: false },
          ],
        },
      ],
    } as Anthropic.MessageCreateParams);

    expect(req.messages[0]).toEqual({
      role: 'system',
      content: 'Base persona\n\nVolatile context',
    });
    expect(req.messages[1]).toEqual({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
        { type: 'text', text: 'What is this?' },
      ],
    });
    expect(req.messages[2]).toEqual({
      role: 'assistant',
      content: 'Let me look.',
      tool_calls: [
        { id: 'tu_1', type: 'function', function: { name: 'search_kb', arguments: '{"q":"x"}' } },
      ],
    });
    expect(req.messages[3]).toEqual({ role: 'tool', tool_call_id: 'tu_1', content: 'found it' });
    expect(req.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'search_kb',
          description: 'Search',
          parameters: { type: 'object', properties: { q: { type: 'string' } } },
        },
      },
    ]);
    expect(req.tool_choice).toBe('auto');
    expect(JSON.stringify(req)).not.toContain('cache_control');
  });

  it('marks a failed tool result so the model knows it failed', () => {
    const req = toOpenAiRequest({
      model: 'm/x',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't',
              content: [{ type: 'text', text: 'boom' }],
              is_error: true,
            },
          ],
        },
      ],
    } as Anthropic.MessageCreateParams);
    expect(req.messages).toEqual([{ role: 'tool', tool_call_id: 't', content: 'Error: boom' }]);
  });
});

describe('OpenRouterClient.stream', () => {
  it('replays text as Anthropic events and joins tool-call fragments into tool_use', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      sseResponse([
        ': OPENROUTER PROCESSING',
        data({ id: 'gen-1', choices: [{ delta: { content: 'Xin ' } }] }),
        data({ choices: [{ delta: { content: 'chào' } }] }),
        data({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'call_a', function: { name: 'remind', arguments: '{"at":' } },
                ],
              },
            },
          ],
        }),
        data({
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"9am"}' } }] } }],
        }),
        data({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        data({ choices: [], usage: { prompt_tokens: 120, completion_tokens: 30 } }),
        'data: [DONE]',
      ]),
    );
    const stream = client(fetchImpl).messages.stream({
      model: 'google/gemini-2.5-flash-lite',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'hi' }],
    });

    const text: string[] = [];
    const types: string[] = [];
    for await (const e of stream) {
      types.push(e.type);
      if (e.type === 'content_block_delta' && e.delta.type === 'text_delta')
        text.push(e.delta.text);
    }
    const message = await stream.finalMessage();

    expect(text.join('')).toBe('Xin chào');
    expect(types[0]).toBe('content_block_start');
    expect(types[types.length - 1]).toBe('content_block_stop');
    expect(message.stop_reason).toBe('tool_use');
    expect(message.content).toEqual([
      { type: 'text', text: 'Xin chào', citations: null },
      { type: 'tool_use', id: 'call_a', name: 'remind', input: { at: '9am' } },
    ]);
    expect(message.usage.input_tokens).toBe(120);
    expect(message.usage.output_tokens).toBe(30);

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: 'google/gemini-2.5-flash-lite', stream: true });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://or.test/api/v1/chat/completions');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer k');
  });

  it('ends a plain answer with end_turn', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        sseResponse([
          data({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }),
          'data: [DONE]',
        ]),
      );
    const stream = client(fetchImpl).messages.stream({
      model: 'm/x',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'hi' }],
    });
    const message = await stream.finalMessage();
    expect(message.stop_reason).toBe('end_turn');
    expect(message.content).toEqual([{ type: 'text', text: 'ok', citations: null }]);
  });

  it('throws an OpenRouterError on an HTTP failure or an in-stream error', async () => {
    const httpFail = jest.fn().mockResolvedValue(new Response('no credits', { status: 402 }));
    const s1 = client(httpFail).messages.stream({
      model: 'm/x',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'hi' }],
    });
    await expect(s1.finalMessage()).rejects.toBeInstanceOf(OpenRouterError);

    const streamFail = jest
      .fn()
      .mockResolvedValue(sseResponse([data({ error: { code: 429, message: 'rate limited' } })]));
    const s2 = client(streamFail).messages.stream({
      model: 'm/x',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'hi' }],
    });
    await expect(s2.finalMessage()).rejects.toThrow('OpenRouter 429: rate limited');
  });
});

/**
 * A fetch that honours the abort signal like the real one: the body yields one
 * line every `gapMs`, and after the lines it hangs (unless `close`) until aborted.
 */
function pacedFetch(lines: string[], gapMs: number, close = true) {
  return jest.fn(async (_url: string, init: { signal?: AbortSignal }) => {
    const encoder = new TextEncoder();
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        init.signal?.addEventListener('abort', () =>
          controller.error(new DOMException('The operation was aborted.', 'AbortError')),
        );
      },
      async pull(controller) {
        if (i >= lines.length) {
          if (close) controller.close();
          else await new Promise(() => undefined);
          return;
        }
        await new Promise((r) => setTimeout(r, gapMs));
        controller.enqueue(encoder.encode(lines[i++] + '\n'));
      },
    });
    return new Response(body, { status: 200 });
  });
}

describe('OpenRouterClient — QC 2026-10-11', () => {
  const ask = { model: 'm/x', max_tokens: 50, messages: [{ role: 'user' as const, content: 'hi' }] };

  it('tool-call ids Claude would reject are normalized, and stay unique across rounds', async () => {
    // Kimi-style ids repeat every round and contain `.` and `:`, which Claude refuses
    // when a later turn (or the fallback) replays the history.
    const round = () =>
      sseResponse([
        data({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'functions.remind:0', function: { name: 'remind', arguments: '{}' } },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        }),
        'data: [DONE]',
      ]);
    const fetchImpl = jest.fn().mockImplementation(async () => round());
    const first = await client(fetchImpl).messages.stream(ask).finalMessage();
    const second = await client(fetchImpl).messages.stream(ask).finalMessage();

    const id1 = (first.content[0] as Anthropic.ToolUseBlock).id;
    const id2 = (second.content[0] as Anthropic.ToolUseBlock).id;
    expect(id1).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(id1.startsWith('functions_remind_0')).toBe(true);
    expect(id1).not.toBe(id2);
  });

  it('a tool call cut off by the token limit is not run with empty arguments', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      sseResponse([
        data({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_1',
                    function: { name: 'send_email', arguments: '{"to":"a@b.c","subj' },
                  },
                ],
              },
              finish_reason: 'length',
            },
          ],
        }),
        'data: [DONE]',
      ]),
    );
    const message = await client(fetchImpl).messages.stream(ask).finalMessage();

    expect(message.content).toEqual([]);
    expect(message.stop_reason).toBe('max_tokens');
  });

  it('a tool call with malformed arguments is dropped; one without arguments is kept', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      sseResponse([
        data({
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'call_1', function: { name: 'send_email', arguments: 'not json' } },
                  { index: 1, id: 'call_2', function: { name: 'list_reminders', arguments: '' } },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        }),
        'data: [DONE]',
      ]),
    );
    const message = await client(fetchImpl).messages.stream(ask).finalMessage();

    expect(message.content).toEqual([
      { type: 'tool_use', id: 'call_2', name: 'list_reminders', input: {} },
    ]);
    expect(message.stop_reason).toBe('tool_use');
  });

  it('a 502/503 or a 429 inside a non-streaming body starts the cooldown', async () => {
    for (const res of [
      () => new Response('upstream down', { status: 503 }),
      () => new Response('bad gateway', { status: 502 }),
      () =>
        new Response(JSON.stringify({ error: { code: 429, message: 'rate limited' } }), {
          status: 200,
        }),
    ]) {
      const onUnavailable = jest.fn();
      const c = new OpenRouterClient({
        apiKey: 'k',
        baseUrl: 'https://or.test/api/v1',
        fetchImpl: jest.fn().mockResolvedValue(res()),
        onUnavailable,
      });
      await expect(c.messages.create(ask)).rejects.toBeInstanceOf(OpenRouterError);
      expect(onUnavailable).toHaveBeenCalled();
    }
  });

  it('a model that never starts answering gives up after the first-token timeout', async () => {
    const fetchImpl = pacedFetch([': OPENROUTER PROCESSING', ': OPENROUTER PROCESSING'], 5, false);
    const c = new OpenRouterClient({
      apiKey: 'k',
      baseUrl: 'https://or.test/api/v1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      firstTokenTimeoutMs: 80,
    });
    const started = Date.now();
    await expect(c.messages.stream(ask).finalMessage()).rejects.toThrow(/no answer/);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('a long answer that keeps streaming is not cut by a total timeout', async () => {
    const lines = Array.from({ length: 8 }, (_, i) =>
      data({ choices: [{ delta: { content: `w${i} ` } }] }),
    );
    const fetchImpl = pacedFetch([...lines, 'data: [DONE]'], 30);
    const c = new OpenRouterClient({
      apiKey: 'k',
      baseUrl: 'https://or.test/api/v1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 100,
      firstTokenTimeoutMs: 1_000,
      idleTimeoutMs: 1_000,
    });
    const message = await c.messages.stream(ask).finalMessage();
    expect((message.content[0] as Anthropic.TextBlock).text).toContain('w7');
  });

  it('a stream that stalls mid-answer gives up after the idle timeout', async () => {
    const fetchImpl = pacedFetch([data({ choices: [{ delta: { content: 'Hi' } }] })], 5, false);
    const c = new OpenRouterClient({
      apiKey: 'k',
      baseUrl: 'https://or.test/api/v1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      idleTimeoutMs: 80,
    });
    await expect(c.messages.stream(ask).finalMessage()).rejects.toThrow(/stalled/);
  });
});

describe('OpenRouterClient.create', () => {
  it('maps a non-streaming completion', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'gen-2',
          choices: [{ message: { content: 'Tiêu đề ngắn' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 4 },
        }),
        { status: 200 },
      ),
    );
    const message = await client(fetchImpl).messages.create({
      model: 'm/x',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'title please' }],
    });
    expect(message.content).toEqual([{ type: 'text', text: 'Tiêu đề ngắn', citations: null }]);
    expect(message.usage.input_tokens).toBe(10);
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent.stream).toBe(false);
    // Reasoning models spend output on thinking: tiny budgets are raised.
    expect(sent.max_tokens).toBe(1024);
  });
});

describe('LlmClientsService', () => {
  const config = (values: Record<string, unknown>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  it('stays on Claude when no OpenRouter key is set', () => {
    const svc = new LlmClientsService(
      config({ 'config.anthropic.fallbackModel': 'claude-haiku-4-5' }),
    );
    expect(svc.openRouterEnabled).toBe(false);
    expect(svc.lightModel).toBe('claude-haiku-4-5');
    expect(svc.clientFor('google/gemini-2.5-flash-lite')).toBe(svc.claude);
  });

  it('routes vendor/model ids to OpenRouter and Claude ids to Anthropic', () => {
    const svc = new LlmClientsService(
      config({
        'config.openRouter.apiKey': 'k',
        'config.openRouter.model': 'google/gemini-2.5-flash-lite',
        'config.anthropic.fallbackModel': 'claude-haiku-4-5',
      }),
    );
    expect(svc.openRouterEnabled).toBe(true);
    expect(svc.lightModel).toBe('google/gemini-2.5-flash-lite');
    expect(svc.clientFor('google/gemini-2.5-flash-lite')).toBeInstanceOf(OpenRouterClient);
    expect(svc.clientFor('claude-sonnet-4-5')).toBe(svc.claude);
  });

  it('retries a failed light call once on the Claude light model', async () => {
    const svc = new LlmClientsService(
      config({
        'config.openRouter.apiKey': 'k',
        'config.openRouter.model': 'google/gemini-2.5-flash-lite',
        'config.anthropic.fallbackModel': 'claude-haiku-4-5',
      }),
    );
    const claudeReply = { content: [{ type: 'text', text: 'from claude' }] } as Anthropic.Message;
    jest
      .spyOn(svc.clientFor('google/gemini-2.5-flash-lite').messages, 'create')
      .mockRejectedValue(new OpenRouterError(402, 'no credits'));
    const claudeCreate = jest.spyOn(svc.claude.messages, 'create').mockResolvedValue(claudeReply);

    const result = await svc.createLight({
      max_tokens: 10,
      messages: [{ role: 'user', content: 'x' }],
    });

    expect(result).toEqual({ message: claudeReply, model: 'claude-haiku-4-5' });
    expect(claudeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5' }),
    );
  });

  it('an empty OpenRouter answer is retried on the Claude light model', async () => {
    const svc = new LlmClientsService(
      config({
        'config.openRouter.apiKey': 'k',
        'config.openRouter.model': 'google/gemini-2.5-flash-lite',
        'config.anthropic.fallbackModel': 'claude-haiku-4-5',
      }),
    );
    // Reasoning-only free models spend the whole budget thinking and return no text.
    jest
      .spyOn(svc.clientFor('google/gemini-2.5-flash-lite').messages, 'create')
      .mockResolvedValue({
        content: [{ type: 'text', text: '  ' }],
        stop_reason: 'max_tokens',
      } as unknown as Anthropic.Message);
    const claudeReply = { content: [{ type: 'text', text: 'from claude' }] } as Anthropic.Message;
    jest.spyOn(svc.claude.messages, 'create').mockResolvedValue(claudeReply);

    const result = await svc.createLight({
      max_tokens: 10,
      messages: [{ role: 'user', content: 'x' }],
    });

    expect(result).toEqual({ message: claudeReply, model: 'claude-haiku-4-5' });
  });

  it('cools down after a 429 so the next turns go straight to Claude', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-07T00:00:00Z') });
    try {
      const fetchImpl = jest
        .fn()
        .mockResolvedValue(new Response('free-models-per-day', { status: 429 }));
      const svc = new LlmClientsService(
        config({
          'config.openRouter.apiKey': 'k',
          'config.openRouter.model': 'google/gemma-4-31b-it:free',
          'config.openRouter.cooldownMs': 600_000,
          'config.anthropic.fallbackModel': 'claude-haiku-4-5',
        }),
      );
      // Swap in a client that uses the fake fetch, keeping the service's 429 hook.
      const hook = (svc as any).openRouter.opts.onUnavailable;
      (svc as any).openRouter = new OpenRouterClient({
        apiKey: 'k',
        baseUrl: 'https://or.test/api/v1',
        fetchImpl,
        onUnavailable: hook,
      });
      jest
        .spyOn(svc.claude.messages, 'create')
        .mockResolvedValue({ content: [] } as unknown as Anthropic.Message);

      expect(svc.lightModel).toBe('google/gemma-4-31b-it:free');
      const first = await svc.createLight({
        max_tokens: 5,
        messages: [{ role: 'user', content: 'x' }],
      });
      expect(first.model).toBe('claude-haiku-4-5');

      // Cooling down: OpenRouter is skipped entirely.
      expect(svc.openRouterEnabled).toBe(false);
      expect(svc.lightModel).toBe('claude-haiku-4-5');
      await svc.createLight({ max_tokens: 5, messages: [{ role: 'user', content: 'y' }] });
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(600_001);
      expect(svc.openRouterEnabled).toBe(true);
      expect(svc.lightModel).toBe('google/gemma-4-31b-it:free');
    } finally {
      jest.useRealTimers();
    }
  });
});
