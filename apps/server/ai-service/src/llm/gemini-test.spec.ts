import { ConfigService } from '@nestjs/config';
import {
  geminiSchema,
  geminiTierModel,
  toGeminiBody,
  GEMINI_BASE_URL,
  GeminiThoughtSignatures,
} from './gemini-test';
import { OpenRouterClient } from './openrouter-client';
import { LlmClientsService } from './llm-clients.service';

describe('geminiTierModel', () => {
  it('is off without a Gemini key, so the tiers stay on Claude', () => {
    expect(geminiTierModel({})).toBeUndefined();
    expect(geminiTierModel({ GEMINI_API_KEY: '' })).toBeUndefined();
  });

  it('defaults to free-tier Flash and honours GEMINI_MODEL', () => {
    expect(geminiTierModel({ GEMINI_API_KEY: 'k' })).toBe('gemini/gemini-3.5-flash-lite');
    expect(geminiTierModel({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-2.5-flash-lite' })).toBe(
      'gemini/gemini-2.5-flash-lite',
    );
  });
});

describe('geminiSchema', () => {
  it('drops keywords Gemini rejects and keeps the ones it understands', () => {
    expect(
      geminiSchema({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        additionalProperties: false,
        properties: {
          to: { type: 'string', format: 'email', description: 'Recipient' },
          when: { type: 'string', format: 'date-time' },
          count: { type: 'integer', exclusiveMinimum: 0, maximum: 10 },
          note: { type: ['string', 'null'] },
          mode: { oneOf: [{ const: 'a' }, { const: 'b' }] },
          level: { type: 'integer', enum: [1, 2] },
          tags: { type: 'array', items: { type: 'string', default: 'x' } },
        },
        required: ['to', 'missing'],
      }),
    ).toEqual({
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient' },
        when: { type: 'string', format: 'date-time' },
        count: { type: 'integer', maximum: 10 },
        note: { type: 'string', nullable: true },
        mode: { anyOf: [{ enum: ['a'] }, { enum: ['b'] }] },
        level: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['to'],
    });
  });
});

describe('toGeminiBody', () => {
  it('sends the bare model id and Gemini-safe tool schemas; argument-less tools send none', () => {
    const body = toGeminiBody({
      model: 'gemini/gemini-2.5-flash',
      stream: true,
      tools: [
        {
          type: 'function',
          function: {
            name: 'mcp__gmail__send_email',
            description: 'Send',
            parameters: { type: 'object', additionalProperties: false, properties: { to: { type: 'string' } } },
          },
        },
        {
          type: 'function',
          function: { name: 'mcp__calendar__list_calendars', parameters: { type: 'object', properties: {} } },
        },
      ],
    });
    expect(body.model).toBe('gemini-2.5-flash');
    expect(body.stream).toBe(true);
    expect(body.reasoning_effort).toBe('low');
    expect(body.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'mcp__gmail__send_email',
          description: 'Send',
          parameters: { type: 'object', properties: { to: { type: 'string' } } },
        },
      },
      { type: 'function', function: { name: 'mcp__calendar__list_calendars' } },
    ]);
  });
});

describe('OpenRouterClient with prepareBody', () => {
  it('posts the rewritten body to the configured base URL', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ id: 'g1', choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }] }),
        { status: 200 },
      ),
    );
    const client = new OpenRouterClient({
      apiKey: 'k',
      baseUrl: GEMINI_BASE_URL,
      fetchImpl,
      prepareBody: toGeminiBody,
    });
    const msg = await client.messages.create({
      model: 'gemini/gemini-2.5-flash',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'hello' }],
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GEMINI_BASE_URL}/chat/completions`);
    expect(JSON.parse(init.body as string).model).toBe('gemini-2.5-flash');
    expect(msg.content).toEqual([expect.objectContaining({ type: 'text', text: 'hi' })]);
  });
});

describe('GeminiThoughtSignatures', () => {
  const sseResponse = (lines: string[]) => new Response(lines.map((l) => `data: ${l}\n`).join('') + 'data: [DONE]\n');

  it('a streamed tool call keeps its signature and gets it back on the next request', async () => {
    const signatures = new GeminiThoughtSignatures();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_7',
                      extra_content: { google: { thought_signature: 'SIG' } },
                      function: { name: 'search', arguments: '{"q":"x"}' },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
        ]),
      )
      .mockResolvedValueOnce(sseResponse([JSON.stringify({ choices: [{ delta: { content: 'done' }, finish_reason: 'stop' }] })]));
    const client = new OpenRouterClient({
      apiKey: 'k',
      baseUrl: GEMINI_BASE_URL,
      fetchImpl,
      prepareBody: (body) => signatures.attach(toGeminiBody(body)),
      onToolCallExtra: signatures.remember,
    });
    const tools = [{ name: 'search', input_schema: { type: 'object' as const, properties: { q: { type: 'string' } } } }];
    const first = client.messages.stream({ model: 'gemini/m', max_tokens: 64, tools, messages: [{ role: 'user', content: 'find x' }] });
    const m1 = await first.finalMessage();
    const call = m1.content.find((b) => b.type === 'tool_use');
    expect(call).toBeDefined();

    const second = client.messages.stream({
      model: 'gemini/m',
      max_tokens: 64,
      tools,
      messages: [
        { role: 'user', content: 'find x' },
        { role: 'assistant', content: m1.content },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: call!.id, content: 'ok' }] },
      ],
    });
    await second.finalMessage();
    const sent = JSON.parse((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body as string);
    const assistant = sent.messages.find((m: { role: string }) => m.role === 'assistant');
    expect(assistant.tool_calls[0].extra_content).toEqual({ google: { thought_signature: 'SIG' } });
  });

  it('a tool call with no remembered signature gets the placeholder Gemini accepts', () => {
    const body = new GeminiThoughtSignatures().attach({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'toolu_claude', type: 'function' }] },
      ],
    });
    expect((body.messages as Array<{ tool_calls?: Array<{ extra_content: unknown }> }>)[1].tool_calls?.[0].extra_content).toEqual({
      google: { thought_signature: 'skip_thought_signature_validator' },
    });
  });
});

describe('LlmClientsService in Gemini test mode', () => {
  const config = (values: Record<string, unknown>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  it('puts Gemini in the OpenRouter slot, ahead of an OpenRouter key, with a short cooldown', () => {
    const svc = new LlmClientsService(
      config({
        'config.gemini.apiKey': 'g',
        'config.gemini.model': 'gemini/gemini-2.5-flash',
        'config.gemini.cooldownMs': 60_000,
        'config.openRouter.apiKey': 'k',
        'config.openRouter.model': 'google/gemini-2.5-flash-lite',
        'config.anthropic.fallbackModel': 'claude-haiku-4-5',
      }),
    );
    expect(svc.openRouterEnabled).toBe(true);
    expect(svc.lightModel).toBe('gemini/gemini-2.5-flash');
    expect(svc.clientFor('gemini/gemini-2.5-flash')).toBeInstanceOf(OpenRouterClient);
    expect(svc.clientFor('claude-sonnet-4-5')).toBe(svc.claude);
  });

  it('stays exactly as before when the Gemini key is empty', () => {
    const svc = new LlmClientsService(
      config({
        'config.gemini.model': undefined,
        'config.anthropic.fallbackModel': 'claude-haiku-4-5',
      }),
    );
    expect(svc.openRouterEnabled).toBe(false);
    expect(svc.lightModel).toBe('claude-haiku-4-5');
  });
});
