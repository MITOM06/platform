import { toExtractionMessages } from './fact-extractor.service';

const only = (msgs: ReturnType<typeof toExtractionMessages>): string => {
  expect(msgs).toHaveLength(1);
  expect(msgs[0].role).toBe('user');
  return msgs[0].content as string;
};

describe('toExtractionMessages', () => {
  it('sends ONE user message, so a history ending in an assistant turn is not a prefill', () => {
    const text = only(
      toExtractionMessages([
        { role: 'user', content: 'Tôi làm kỹ sư backend ở PON.' },
        { role: 'assistant', content: 'Đã ghi nhớ!' },
        { role: 'user', content: 'Món tôi thích nhất là phở bò Nam Định.' },
        { role: 'assistant', content: 'Phở bò ngon thật đó.' },
      ]),
    );
    expect(text).toContain('User: Tôi làm kỹ sư backend ở PON.');
    expect(text).toContain('User: Món tôi thích nhất là phở bò Nam Định.');
    expect(text).toContain('Assistant: Phở bò ngon thật đó.');
    expect(text.trim().endsWith('as instructed.')).toBe(true);
  });

  it('turns an image message into a marker instead of an empty turn (was a 400)', () => {
    const text = only(
      toExtractionMessages([
        { role: 'user', content: 'Ảnh con mèo của tôi' },
        { role: 'user', content: '', type: 'image', imageUrls: ['/api/uploads/abc'] },
        { role: 'user', content: 'hóa đơn tháng 9', type: 'image', imageUrls: ['/api/uploads/x'] },
      ]),
    );
    expect(text).toContain('User: [image]\n');
    expect(text).toContain('User: [image] hóa đơn tháng 9');
  });

  it('drops blank turns and returns nothing when the user never said anything', () => {
    expect(toExtractionMessages([{ role: 'assistant', content: 'Xin chào!' }, { role: 'user', content: '  ' }])).toEqual([]);
  });

  it('only looks at the last 20 turns', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn ${i}`,
    }));
    const text = only(toExtractionMessages(history));
    expect(text).not.toContain('turn 9\n');
    expect(text).toContain('User: turn 10');
    expect(text).toContain('Assistant: turn 29');
  });
});

describe('FactExtractorService.extractFacts', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FactExtractorService } = require('./fact-extractor.service');
  const history = [{ role: 'user' as const, content: 'I work on PON' }];

  function make(text: string, viaLlm = true) {
    const message = { content: [{ type: 'text', text }], usage: { input_tokens: 3, output_tokens: 4 } };
    const memory = { addFacts: jest.fn().mockResolvedValue(undefined) };
    const usage = { recordModelCall: jest.fn() };
    const llm = { createLight: jest.fn().mockResolvedValue({ message }) };
    const svc = new FactExtractorService(
      { get: jest.fn().mockReturnValue(undefined) },
      memory,
      usage,
      viaLlm ? llm : undefined,
    );
    const create = jest.fn().mockResolvedValue(message);
    svc.anthropic = { messages: { create } };
    return { svc, memory, usage, llm, create };
  }

  it('stores the summary and only the string facts, billed to the user', async () => {
    const m = make('User works on PON.\nFACTS: ["Works on PON", 42, "Likes pho"]');
    await m.svc.extractFacts('c1', 'u1', history, 3);
    expect(m.memory.addFacts).toHaveBeenCalledWith('c1', 'u1', ['Works on PON', 'Likes pho'], 'User works on PON.', 3);
    expect(m.usage.recordModelCall).toHaveBeenCalledWith('u1', { input_tokens: 3, output_tokens: 4 }, 'fact-extraction');
  });

  it('stores no facts when the FACTS array is not valid JSON or not an array', async () => {
    const bad = make('Summary.\nFACTS: [not json]');
    await bad.svc.extractFacts('c1', 'u1', history, 3);
    expect(bad.memory.addFacts).toHaveBeenCalledWith('c1', 'u1', [], 'Summary.', 3);

    const none = make('Only a summary.');
    await none.svc.extractFacts('c1', 'u1', history, 20);
    expect(none.memory.addFacts).toHaveBeenCalledWith('c1', 'u1', [], 'Only a summary.', 20);
  });

  it('skips the model call when the user never said anything', async () => {
    const m = make('x');
    await m.svc.extractFacts('c1', 'u1', [{ role: 'assistant', content: 'hi' }], 3);
    expect(m.llm.createLight).not.toHaveBeenCalled();
    expect(m.memory.addFacts).not.toHaveBeenCalled();
  });

  it('uses Haiku directly when no light-LLM router is wired', async () => {
    const m = make('S\nFACTS: []', false);
    await m.svc.extractFacts('c1', 'u1', history, 3);
    expect(m.create.mock.calls[0][0]).toMatchObject({ model: 'claude-haiku-4-5', max_tokens: 512 });
  });
});
