import { googleErrorReason, summarizeEvents, summarizeThreads, threadSummary } from './google-format';

describe('summarizeEvents', () => {
  it('empty list → explicit "no events" sentence', () => {
    expect(summarizeEvents([])).toBe('No events found in that time range.');
  });

  it('renders timed + all-day events with optional fields only when present', () => {
    const out = summarizeEvents([
      {
        id: 'e1',
        summary: 'Standup',
        start: { dateTime: '2026-11-06T09:00:00+07:00' },
        end: { dateTime: '2026-11-06T09:15:00+07:00' },
        location: 'Room A',
        attendees: [{}, {}],
        status: 'confirmed',
      },
      { start: { date: '2026-11-07' }, end: {}, status: 'tentative', attendees: [] },
    ]);
    expect(out.split('\n')).toEqual([
      '2 event(s):',
      '1. Standup · 2026-11-06T09:00:00+07:00 → 2026-11-06T09:15:00+07:00 · location: Room A · attendees: 2 · id: e1',
      '2. (no title) · 2026-11-07 (all day) → ? · status: tentative',
    ]);
  });

  it('clips long titles to 120 chars', () => {
    const out = summarizeEvents([{ summary: 'x'.repeat(500), start: {}, end: {} }]);
    const title = out.split('\n')[1].split(' · ')[0];
    expect(title).toBe(`1. ${'x'.repeat(119)}…`);
  });
});

describe('summarizeThreads', () => {
  it('no threads → names the query', () => {
    expect(summarizeThreads('from:alice', [])).toBe('No email threads match "from:alice".');
  });

  it('lists threads with "showing N of about M" only when the estimate is larger', () => {
    const threads = [
      { id: 't1', messageCount: 3, from: 'Alice', subject: 'Hi', date: 'Mon', snippet: 'hello there' },
      { id: 't2', messageCount: 1 },
    ];
    expect(summarizeThreads('q', threads, 10).split('\n')).toEqual([
      'Found 2 thread(s) for "q" (showing 2 of about 10):',
      '1. Hi · from: Alice · date: Mon · messages: 3 · id: t1',
      '   hello there',
      '2. (no subject) · messages: 1 · id: t2',
    ]);
    expect(summarizeThreads('q', threads, 2).split('\n')[0]).toBe('Found 2 thread(s) for "q":');
    expect(summarizeThreads('q', threads).split('\n')[0]).toBe('Found 2 thread(s) for "q":');
  });
});

describe('threadSummary', () => {
  const msg = (headers: Record<string, string>, snippet?: string) => ({
    snippet,
    payload: { headers: Object.entries(headers).map(([name, value]) => ({ name, value })) },
  });

  it('subject from the first message, from/date/snippet from the latest (case-insensitive headers)', () => {
    const s = threadSummary({
      id: 't1',
      messages: [
        msg({ Subject: 'Plan', From: 'alice@x' }, 'first'),
        msg({ FROM: 'bob@x', Date: 'Tue', subject: 'Re: Plan' }, 'latest'),
      ],
    });
    expect(s).toEqual({ id: 't1', messageCount: 2, from: 'bob@x', subject: 'Plan', date: 'Tue', snippet: 'latest' });
  });

  it('falls back across messages and to the thread snippet', () => {
    const s = threadSummary({ id: 't2', snippet: 'thread', messages: [msg({ From: 'a@x' }), msg({ Subject: 'S' })] });
    expect(s).toEqual({ id: 't2', messageCount: 2, from: 'a@x', subject: 'S', date: undefined, snippet: 'thread' });
  });

  it('no messages → count 1, empty id fallback', () => {
    expect(threadSummary({})).toEqual({
      id: '',
      messageCount: 1,
      from: undefined,
      subject: undefined,
      date: undefined,
      snippet: undefined,
    });
  });
});

describe('googleErrorReason (never echoes the body)', () => {
  it.each([
    ['{"error":{"errors":[{"reason":"insufficientPermissions"}],"status":"PERMISSION_DENIED"}}', 'insufficientPermissions'],
    ['{"error":{"status":"NOT_FOUND"}}', 'NOT_FOUND'],
    ['{"error":"invalid_grant"}', 'invalid_grant'],
    ['{"error":"Bearer ya29.secret-token leaked"}', undefined],
    ['{"error":{"errors":[{"reason":"bad reason with spaces"}],"status":"lower_case"}}', undefined],
    ['{"error":{"status":"' + 'A'.repeat(65) + '"}}', undefined],
    ['<html>502</html>', undefined],
    ['null', undefined],
    ['{}', undefined],
  ])('%s → %s', (body, expected) => {
    expect(googleErrorReason(body)).toBe(expected);
  });
});
