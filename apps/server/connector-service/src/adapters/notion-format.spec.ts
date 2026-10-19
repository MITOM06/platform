import {
  blockText,
  notionErrorReason,
  notionId,
  paragraphs,
  propText,
  richText,
  titleOf,
} from './notion-format';

describe('notion-format', () => {
  describe('titleOf', () => {
    it('reads a page title from its title-typed property, whatever the property is called', () => {
      expect(
        titleOf({ properties: { 'Task name': { type: 'title', title: [{ plain_text: 'Ship C1' }] } } }),
      ).toBe('Ship C1');
    });

    it('reads a data source title from its top-level title', () => {
      expect(titleOf({ title: [{ plain_text: 'Tasks' }] })).toBe('Tasks');
    });

    it('falls back to (untitled)', () => {
      expect(titleOf({ properties: {} })).toBe('(untitled)');
      expect(titleOf({ title: [] })).toBe('(untitled)');
    });
  });

  describe('propText', () => {
    it.each([
      [{ type: 'status', status: { name: 'In progress' } }, 'In progress'],
      [{ type: 'select', select: { name: 'High' } }, 'High'],
      [{ type: 'multi_select', multi_select: [{ name: 'C1' }, { name: 'notion' }] }, 'C1, notion'],
      [{ type: 'people', people: [{ name: 'Minh' }] }, 'Minh'],
      [{ type: 'date', date: { start: '2026-11-06' } }, '2026-11-06'],
      [{ type: 'date', date: { start: '2026-11-01', end: '2026-11-06' } }, '2026-11-01 → 2026-11-06'],
      [{ type: 'checkbox', checkbox: false }, 'false'],
      [{ type: 'number', number: 3 }, '3'],
      [{ type: 'rich_text', rich_text: [{ plain_text: 'REST, not MCP' }] }, 'REST, not MCP'],
    ])('summarises %j as %s', (prop, expected) => {
      expect(propText(prop as never)).toBe(expected);
    });

    it('returns null for empty values and for types it does not summarise', () => {
      expect(propText({ type: 'status', status: null })).toBeNull();
      expect(propText({ type: 'number', number: null })).toBeNull();
      expect(propText({ type: 'date', date: null })).toBeNull();
      expect(propText({ type: 'rich_text', rich_text: [] })).toBeNull();
      expect(propText({ type: 'title', title: [{ plain_text: 'x' }] })).toBeNull();
      expect(propText({ type: 'formula' })).toBeNull();
    });
  });

  describe('blockText', () => {
    const rt = (s: string) => ({ rich_text: [{ plain_text: s }] });

    it('turns blocks into one markdown-ish line', () => {
      expect(blockText({ type: 'heading_1', heading_1: rt('Goals') })).toBe('# Goals');
      expect(blockText({ type: 'heading_3', heading_3: rt('Small') })).toBe('### Small');
      expect(blockText({ type: 'paragraph', paragraph: rt('Ship C1') })).toBe('Ship C1');
      expect(blockText({ type: 'bulleted_list_item', bulleted_list_item: rt('Connect') })).toBe('- Connect');
      expect(blockText({ type: 'quote', quote: rt('Q') })).toBe('> Q');
      expect(blockText({ type: 'to_do', to_do: { ...rt('Enable APIs'), checked: true } })).toBe('[x] Enable APIs');
      expect(blockText({ type: 'to_do', to_do: { ...rt('Reconnect'), checked: false } })).toBe('[ ] Reconnect');
    });

    it('returns an empty string for blocks without text', () => {
      expect(blockText({ type: 'divider', divider: {} })).toBe('');
      expect(blockText({ type: 'paragraph', paragraph: rt('') })).toBe('');
    });
  });

  describe('richText / paragraphs', () => {
    it("splits text longer than Notion's 2000-character limit into chunks", () => {
      const sizes = richText('a'.repeat(4500)).map((r) => r.text.content.length);
      expect(sizes).toEqual([2000, 2000, 500]);
    });

    it('makes one paragraph per non-empty line', () => {
      expect(paragraphs('Done: C1\n\n  Next: C3  ')).toEqual([
        { object: 'block', type: 'paragraph', paragraph: { rich_text: richText('Done: C1') } },
        { object: 'block', type: 'paragraph', paragraph: { rich_text: richText('Next: C3') } },
      ]);
    });

    it('makes no paragraph out of blank text', () => {
      expect(paragraphs('  \n ')).toEqual([]);
    });
  });

  describe('notionErrorReason', () => {
    it("returns Notion's machine code, never the message", () => {
      expect(notionErrorReason('{"object":"error","code":"object_not_found","message":"secret page title"}')).toBe(
        'object_not_found',
      );
    });

    it('returns undefined for non-JSON bodies and odd codes', () => {
      expect(notionErrorReason('<html>bad gateway</html>')).toBeUndefined();
      expect(notionErrorReason('{"code":"Has Spaces & Symbols"}')).toBeUndefined();
      expect(notionErrorReason('{"code":42}')).toBeUndefined();
    });
  });

  describe('notionId', () => {
    it.each(['0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', '0a1b2c3d4e5f4a6b8c7d9e0f1a2b3c4d'])('accepts %s', (id) => {
      expect(notionId(id, 'pageId')).toBe(id);
    });

    it.each([undefined, '', 42, '../../v1/users', 'abc', '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d/children', 'zzzzzzzz-4e5f-4a6b-8c7d-9e0f1a2b3c4d'])(
      'rejects %j with INVALID_INPUT (it ends up in a URL path)',
      (id) => {
        expect(() => notionId(id, 'pageId')).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
      },
    );
  });
});
