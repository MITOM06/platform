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
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).stream).toBe(false);
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
});
