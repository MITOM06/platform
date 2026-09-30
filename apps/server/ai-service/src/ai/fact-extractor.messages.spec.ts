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
