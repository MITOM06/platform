import { buildActionSummary, humanizeToolName } from './pending-action-summary';
import { needsConfirmation, normalizedToolName } from './pending-action-policy';
import { ToolDefinition } from '../tools/tool.interface';

const schema = { type: 'object' as const, properties: {}, required: [] as string[] };
const def = (name: string, sensitive?: boolean): ToolDefinition => ({
  name,
  description: '',
  input_schema: schema,
  ...(sensitive === undefined ? {} : { sensitive }),
});

describe('buildActionSummary', () => {
  it('gmail send: recipients + subject only — never the body', () => {
    const summary = buildActionSummary('mcp__gmail__send_email', {
      to: 'bob@example.com, ann@example.com',
      subject: 'Q3 report',
      body: 'confidential numbers',
    });
    expect(summary).toEqual({
      kind: 'send_email',
      to: 'bob@example.com, ann@example.com',
      subject: 'Q3 report',
    });
    expect(JSON.stringify(summary)).not.toContain('confidential');
  });

  it('gmail draft → draft_email; recipient arrays are joined', () => {
    expect(
      buildActionSummary('mcp__gmail__create_draft', { to: ['a@x.io', { email: 'b@x.io' }], subject: 'Hi' }),
    ).toEqual({ kind: 'draft_email', to: 'a@x.io, b@x.io', subject: 'Hi' });
  });

  it('strips control characters and caps long values', () => {
    const summary = buildActionSummary('mcp__gmail__send_email', {
      to: 'bob@example.com',
      subject: `Line one\r\nBcc: evil@x.io ${'x'.repeat(400)}`,
    }) as { subject: string };
    expect(summary.subject).not.toMatch(/[\r\n]/);
    expect(summary.subject.length).toBeLessThanOrEqual(150);
    expect(summary.subject.endsWith('…')).toBe(true);
  });

  it('calendar create/update: title + start + end + attendees, never ids or description', () => {
    expect(
      buildActionSummary('mcp__calendar__create_event', {
        summary: 'Sprint review',
        start: '2026-10-06T09:00:00+07:00',
        end: '2026-10-06T10:00:00+07:00',
        attendees: ['bob@example.com'],
        description: 'agenda',
      }),
    ).toEqual({
      kind: 'create_event',
      title: 'Sprint review',
      start: '2026-10-06T09:00:00+07:00',
      end: '2026-10-06T10:00:00+07:00',
      attendees: 'bob@example.com',
    });
    const update = buildActionSummary('mcp__calendar__update_event', {
      eventId: 'evt_9f8e7d6c5b4a',
      summary: 'Moved review',
      start: { dateTime: '2026-10-07T09:00:00+07:00' },
    });
    expect(update).toEqual({ kind: 'update_event', title: 'Moved review', start: '2026-10-07T09:00:00+07:00' });
    expect(JSON.stringify(update)).not.toContain('evt_');
  });

  it('notion create/update: the title, from flat, Notion-properties and hosted-MCP shapes', () => {
    expect(buildActionSummary('mcp__notion__create_page', { title: 'Roadmap', parent: { page_id: 'abc' } })).toEqual({
      kind: 'create_page',
      title: 'Roadmap',
    });
    expect(
      buildActionSummary('mcp__notion__notion-create-pages', {
        pages: [{ properties: { title: 'Q4 plan' }, content: '...' }],
      }),
    ).toEqual({ kind: 'create_page', title: 'Q4 plan' });
    const update = buildActionSummary('mcp__notion__notion-update-page', {
      data: { page_id: '1f2e3d4c5b6a', properties: { Name: { title: [{ text: { content: 'Launch' } }] } } },
    });
    expect(update).toEqual({ kind: 'update_page', title: 'Launch' });
    expect(JSON.stringify(update)).not.toContain('1f2e3d4c5b6a');
  });

  it('anything else: a generic, humanized tool label (no provider ids)', () => {
    const summary = buildActionSummary('mcp__custom_0123456789abcdef01234567__archive_record', {
      recordId: 'r-1',
    });
    expect(summary).toEqual({ kind: 'generic', tool: 'Archive record' });
    expect(JSON.stringify(summary)).not.toContain('0123456789abcdef');
    // send_message means email only on Gmail.
    expect(buildActionSummary('mcp__slack__send_message', { channel: 'C1', text: 'hi' })).toEqual({
      kind: 'generic',
      tool: 'Send message',
      fields: [
        { label: 'Channel', value: 'C1' },
        { label: 'Text', value: 'hi' },
      ],
    });
  });

  // QC 2026-10-11: the card only named the tool or "to + subject", so a prompt
  // injection could add `bcc: attacker@x` / an extra attendee / any argument the
  // user never saw, and a confirm ran exactly that.
  it('emails also show cc and bcc (still never the body)', () => {
    const summary = buildActionSummary('mcp__gmail__send_email', {
      to: 'boss@corp.com',
      cc: ['team@corp.com'],
      bcc: 'attacker@evil.com',
      subject: 'Q3',
      body: 'confidential numbers',
    });
    expect(summary).toEqual({
      kind: 'send_email',
      to: 'boss@corp.com',
      cc: 'team@corp.com',
      bcc: 'attacker@evil.com',
      subject: 'Q3',
    });
    expect(JSON.stringify(summary)).not.toContain('confidential');
  });

  it('generic tools list their arguments: labels humanized, ids and secrets left out, capped', () => {
    const summary = buildActionSummary('mcp__custom_0123456789abcdef01234567__create_ticket', {
      title: 'Printer on floor 3 is broken',
      priority: 2,
      urgent: true,
      assigneeId: '64b0000000000000000000a1',
      api_key: 'sk-live-123',
      labels: ['it', 'hardware'],
      nested: { deep: 'object' },
      notes: 'n'.repeat(400),
    }) as { fields: { label: string; value: string }[] };
    expect(summary.fields.slice(0, 4)).toEqual([
      { label: 'Title', value: 'Printer on floor 3 is broken' },
      { label: 'Priority', value: '2' },
      { label: 'Urgent', value: 'true' },
      { label: 'Labels', value: 'it, hardware' },
    ]);
    const all = JSON.stringify(summary);
    expect(all).not.toContain('64b0000000000000000000a1');
    expect(all).not.toContain('sk-live');
    expect(all).not.toContain('deep');
    const notes = summary.fields.find((f) => f.label === 'Notes')!;
    expect(notes.value.length).toBeLessThanOrEqual(120);
  });

  it('argument labels: snake_case, kebab-case and camelCase read as words; *_id / *Ids are ids', () => {
    expect(
      buildActionSummary('mcp__x__y', {
        due_date: 'tomorrow',
        'send-at': '9am',
        assigneeName: 'Bob',
        page_id: 'p1',
        userIds: ['a'],
      }),
    ).toEqual({
      kind: 'generic',
      tool: 'Y',
      fields: [
        { label: 'Due date', value: 'tomorrow' },
        { label: 'Send at', value: '9am' },
        { label: 'Assignee name', value: 'Bob' },
      ],
    });
  });

  it('a generic tool lists at most 6 arguments', () => {
    const input = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`field${i}`, `v${i}`]));
    const summary = buildActionSummary('mcp__custom_x__do_it', input) as { fields: unknown[] };
    expect(summary.fields).toHaveLength(6);
  });

  it('humanizes hosted-MCP names', () => {
    expect(humanizeToolName('mcp__notion__notion-duplicate-page')).toBe('Duplicate page');
    expect(normalizedToolName('mcp__notion__notion-create-pages')).toBe('create_pages');
  });
});

describe('needsConfirmation', () => {
  it('connector tools flagged sensitive need confirmation; read-only ones do not', () => {
    expect(needsConfirmation('mcp__gmail__send_email', def('mcp__gmail__send_email', true))).toBe(true);
    expect(needsConfirmation('mcp__gmail__search_threads', def('mcp__gmail__search_threads', false))).toBe(false);
  });

  it('the low-risk allow-list (create_draft) runs without confirmation', () => {
    expect(needsConfirmation('mcp__gmail__create_draft', def('mcp__gmail__create_draft', true))).toBe(false);
  });

  it('built-ins never need confirmation', () => {
    for (const name of ['create_reminder', 'remember_fact', 'search_messages', 'web_search', 'get_user_info']) {
      expect(needsConfirmation(name, def(name))).toBe(false);
    }
  });

  it('fails closed for a connector definition without a flag', () => {
    expect(needsConfirmation('mcp__x__do_thing', def('mcp__x__do_thing'))).toBe(true);
    expect(needsConfirmation('mcp__x__do_thing', undefined)).toBe(true);
  });
});
