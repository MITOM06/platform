import { CallSummaryService } from './call-summary.service';

describe('CallSummaryService — pure helpers', () => {
  describe('parseSegments', () => {
    it('orders segments by ts and renders speaker lines using the name map', () => {
      const raw = [
        JSON.stringify({ userId: 'u2', displayName: 'u2', text: 'second', ts: 200 }),
        JSON.stringify({ userId: 'u1', displayName: 'u1', text: 'first', ts: 100 }),
        JSON.stringify({ userId: 'u3', displayName: 'u3', text: 'third', ts: 300 }),
      ];
      const nameMap = new Map([
        ['u1', 'Alice'],
        ['u2', 'Bob'],
        ['u3', 'Cara'],
      ]);
      const segments = CallSummaryService.parseSegments(raw);
      expect(segments.map((s) => s.text)).toEqual(['first', 'second', 'third']);
      expect(CallSummaryService.renderTranscriptLines(segments, nameMap)).toBe(
        'Alice: first\nBob: second\nCara: third',
      );
    });

    it('drops malformed JSON and empty-text segments', () => {
      const raw = [
        'not json',
        JSON.stringify({ displayName: 'Alice', text: '', ts: 50 }),
        JSON.stringify({ displayName: 'Alice', text: 'hello', ts: 10 }),
      ];
      const segments = CallSummaryService.parseSegments(raw);
      expect(segments).toHaveLength(1);
      expect(segments[0].text).toBe('hello');
    });

    it('defaults missing displayName/ts', () => {
      const raw = [JSON.stringify({ text: 'orphan' })];
      const segments = CallSummaryService.parseSegments(raw);
      expect(segments[0].displayName).toBe('Unknown');
      expect(segments[0].ts).toBe(0);
    });
  });

  describe('parseSummaryJson', () => {
    it('parses strict JSON', () => {
      const out = CallSummaryService.parseSummaryJson(
        '{"overview":"A meeting","keyPoints":["p1","p2"],"actionItems":["do x"]}',
      );
      expect(out.overview).toBe('A meeting');
      expect(out.keyPoints).toEqual(['p1', 'p2']);
      expect(out.actionItems).toEqual(['do x']);
    });

    it('strips ```json code fences', () => {
      const fenced = '```json\n{"overview":"hi","keyPoints":[],"actionItems":[]}\n```';
      const out = CallSummaryService.parseSummaryJson(fenced);
      expect(out.overview).toBe('hi');
    });

    it('isolates a JSON object embedded in prose', () => {
      const raw = 'Here is the summary: {"overview":"x","keyPoints":["k"],"actionItems":[]} done.';
      const out = CallSummaryService.parseSummaryJson(raw);
      expect(out.overview).toBe('x');
      expect(out.keyPoints).toEqual(['k']);
    });

    it('falls back to raw overview on unparseable input', () => {
      const out = CallSummaryService.parseSummaryJson('totally not json');
      expect(out.overview).toBe('totally not json');
      expect(out.keyPoints).toEqual([]);
      expect(out.actionItems).toEqual([]);
    });

    it('filters non-string and blank array entries', () => {
      const out = CallSummaryService.parseSummaryJson(
        '{"overview":"o","keyPoints":["a", 5, "", "  b "],"actionItems":null}',
      );
      expect(out.keyPoints).toEqual(['a', 'b']);
      expect(out.actionItems).toEqual([]);
    });
  });

  describe('computeDurationSec', () => {
    it('computes whole seconds between start and end', () => {
      const start = new Date('2026-06-22T10:00:00Z');
      const end = new Date('2026-06-22T10:02:30Z');
      expect(CallSummaryService.computeDurationSec(start, end)).toBe(150);
    });

    it('returns 0 when end is missing or before start', () => {
      const start = new Date('2026-06-22T10:00:00Z');
      expect(CallSummaryService.computeDurationSec(start, null)).toBe(0);
      expect(CallSummaryService.computeDurationSec(null, start)).toBe(0);
      expect(
        CallSummaryService.computeDurationSec(start, new Date('2026-06-22T09:00:00Z')),
      ).toBe(0);
    });
  });

  describe('distinct', () => {
    it('dedups while preserving first-seen order', () => {
      expect(CallSummaryService.distinct(['Alice', 'Bob', 'Alice', 'Cara'])).toEqual([
        'Alice',
        'Bob',
        'Cara',
      ]);
    });
  });

  describe('resolveName', () => {
    const nameMap = new Map([['u1', 'Alice']]);

    it('maps a known userId to its display name', () => {
      expect(CallSummaryService.resolveName('u1', nameMap)).toBe('Alice');
    });

    it('falls back to the raw userId when the id is missing from the map', () => {
      expect(CallSummaryService.resolveName('6a3782aaaaaaaaaaaaaaaaaa', nameMap)).toBe(
        '6a3782aaaaaaaaaaaaaaaaaa',
      );
    });

    it('uses the fallback name when no userId is present', () => {
      expect(CallSummaryService.resolveName('', nameMap, 'Bob')).toBe('Bob');
      expect(CallSummaryService.resolveName(undefined, nameMap)).toBe('Unknown');
    });

    it('renders transcript lines with ids resolved to names and raw fallback', () => {
      const segments = CallSummaryService.parseSegments([
        JSON.stringify({ userId: 'u1', displayName: 'u1', text: 'hi', ts: 1 }),
        JSON.stringify({ userId: 'u2', displayName: 'u2', text: 'yo', ts: 2 }),
      ]);
      // u1 resolves; u2 is unknown -> raw id.
      expect(CallSummaryService.renderTranscriptLines(segments, nameMap)).toBe('Alice: hi\nu2: yo');
    });
  });

  describe('collectUserIds', () => {
    it('collects distinct ids from segments and participants, ignoring blanks', () => {
      const segments = CallSummaryService.parseSegments([
        JSON.stringify({ userId: 'u1', displayName: 'u1', text: 'a', ts: 1 }),
        JSON.stringify({ userId: '', displayName: 'x', text: 'b', ts: 2 }),
      ]);
      const ids = CallSummaryService.collectUserIds(segments, [
        { userId: 'u1' },
        { userId: 'u2' },
        { userId: '' },
      ]);
      expect(ids).toEqual(['u1', 'u2']);
    });
  });

  describe('deriveSessionMeta', () => {
    const nameMap = new Map([
      ['u1', 'Alice'],
      ['u2', 'Bob'],
    ]);

    it('resolves joined participant ids to display names', () => {
      const session = {
        participants: [
          { userId: 'u1', displayName: 'u1', joinedAt: new Date('2026-06-22T10:00:00Z') },
          { userId: 'u2', displayName: 'u2', joinedAt: new Date('2026-06-22T10:00:00Z') },
          { userId: 'u3', displayName: 'u3', joinedAt: null },
        ],
        startedAt: new Date('2026-06-22T10:00:00Z'),
        endedAt: new Date('2026-06-22T10:01:00Z'),
      } as unknown as Parameters<typeof CallSummaryService.deriveSessionMeta>[0];

      const meta = CallSummaryService.deriveSessionMeta(session, [], nameMap, 'call-1');
      expect(meta.attendees).toEqual(['Alice', 'Bob']);
      expect(meta.durationSec).toBe(60);
    });

    it('falls back to transcript speakers (resolved) when session is missing', () => {
      const segments = CallSummaryService.parseSegments([
        JSON.stringify({ userId: 'u1', displayName: 'u1', text: 'a', ts: 1 }),
        JSON.stringify({ userId: 'u9', displayName: 'u9', text: 'b', ts: 2 }),
      ]);
      const meta = CallSummaryService.deriveSessionMeta(null, segments, nameMap, 'call-1');
      expect(meta.attendees).toEqual(['Alice', 'u9']);
      expect(meta.durationSec).toBe(0);
    });
  });
});

describe('CallSummaryService — one summary per call across instances', () => {
  // call:summarize is pub/sub: every ai-service instance receives it. Without a
  // claim each one would pay for its own model call (chat-service then drops the
  // duplicates, but the tokens are spent).
  it('only the instance that claims the call reads the transcript', async () => {
    const redis = {
      set: jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null),
      lrange: jest.fn().mockResolvedValue([]),
    };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const svc = new CallSummaryService(
      redis as never,
      {} as never,
      {} as never,
      { publishToChannel: jest.fn() } as never,
      config as never,
    );

    await svc.summarize({ callId: 'c1', conversationId: 'conv' });
    await svc.summarize({ callId: 'c1', conversationId: 'conv' });

    expect(redis.set).toHaveBeenCalledWith('call:summarize:claim:c1', '1', 'EX', 3600, 'NX');
    expect(redis.lrange).toHaveBeenCalledTimes(1);
  });
});

describe('CallSummaryService.summarize — end to end', () => {
  const U1 = '507f1f77bcf86cd799439011';
  const U2 = '507f1f77bcf86cd799439012';

  function make(opts: {
    segments?: unknown[];
    session?: unknown;
    users?: unknown[];
    usersError?: Error;
    reply?: string | Error;
  }) {
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      lrange: jest.fn().mockResolvedValue((opts.segments ?? []).map((s) => JSON.stringify(s))),
    };
    const sessionModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(opts.session ?? null) }),
      }),
    };
    const usersExec = opts.usersError
      ? jest.fn().mockRejectedValue(opts.usersError)
      : jest.fn().mockResolvedValue(opts.users ?? []);
    const userModel = { find: jest.fn().mockReturnValue({ lean: () => ({ exec: usersExec }) }) };
    const publisher = { publishToChannel: jest.fn().mockResolvedValue(undefined) };
    const usage = { recordModelCall: jest.fn() };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const svc = new CallSummaryService(
      redis as never,
      sessionModel as never,
      userModel as never,
      publisher as never,
      config as never,
      usage as never,
    );
    const create =
      opts.reply instanceof Error
        ? jest.fn().mockRejectedValue(opts.reply)
        : jest.fn().mockResolvedValue({
            content: [{ type: 'text', text: opts.reply ?? '{"overview":"o","keyPoints":["k"],"actionItems":[]}' }],
            usage: { input_tokens: 5, output_tokens: 7 },
          });
    (svc as unknown as { anthropic: unknown }).anthropic = { messages: { create } };
    return { svc, redis, sessionModel, userModel, publisher, usage, create };
  }

  const segs = [
    { userId: U2, displayName: U2, text: 'second', ts: 2 },
    { userId: U1, displayName: U1, text: 'first', ts: 1 },
  ];

  it('publishes nothing and skips the model when the transcript is empty', async () => {
    const m = make({ segments: [] });
    await m.svc.summarize({ callId: 'c1', conversationId: 'conv' });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.publisher.publishToChannel).not.toHaveBeenCalled();
  });

  it('resolves speaker names, bills the bot user and publishes the structured summary', async () => {
    const m = make({
      segments: segs,
      session: {
        participants: [
          { userId: U1, joinedAt: new Date() },
          { userId: U2, joinedAt: new Date() },
          { userId: 'never-joined', joinedAt: null },
        ],
        startedAt: new Date('2026-01-01T10:00:00Z'),
        endedAt: new Date('2026-01-01T10:05:00Z'),
      },
      users: [
        { _id: U1, displayName: ' Alice ' },
        { _id: U2, displayName: 'Bob' },
      ],
    });

    await m.svc.summarize({ callId: 'c1', conversationId: 'conv' });

    expect(m.create.mock.calls[0][0].messages[0].content).toBe('Transcript:\n\nAlice: first\nBob: second');
    expect(m.usage.recordModelCall).toHaveBeenCalledWith(
      'ai-bot-000000000000000000000001',
      { input_tokens: 5, output_tokens: 7 },
      'call-summary',
    );
    expect(m.publisher.publishToChannel).toHaveBeenCalledWith('call:summary:result', {
      conversationId: 'conv',
      callId: 'c1',
      payload: {
        attendees: ['Alice', 'Bob'],
        durationSec: 300,
        overview: 'o',
        keyPoints: ['k'],
        actionItems: [],
      },
    });
  });

  it('skips the user lookup when no id is an ObjectId', async () => {
    const m = make({ segments: [{ userId: 'extbot:1', displayName: 'Bot', text: 'hi', ts: 1 }] });
    await m.svc.summarize({ callId: 'c1', conversationId: 'conv' });
    expect(m.userModel.find).not.toHaveBeenCalled();
    expect(m.publisher.publishToChannel).toHaveBeenCalledTimes(1);
  });

  it('still publishes when the name lookup fails', async () => {
    const m = make({ segments: segs, usersError: new Error('mongo down') });
    await m.svc.summarize({ callId: 'c1', conversationId: 'conv' });
    expect(m.publisher.publishToChannel).toHaveBeenCalledTimes(1);
  });

  it('publishes a "Summary unavailable." placeholder when the model call fails', async () => {
    const m = make({ segments: segs, reply: new Error('529') });
    await m.svc.summarize({ callId: 'c1', conversationId: 'conv' });
    const payload = m.publisher.publishToChannel.mock.calls[0][1].payload;
    expect(payload).toMatchObject({ overview: 'Summary unavailable.', keyPoints: [], actionItems: [] });
  });
});
