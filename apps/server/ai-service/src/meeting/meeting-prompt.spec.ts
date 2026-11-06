import { renderMeetingPrompt, parseMeetingSummary } from './meeting-prompt';
import { MeetingRecordView } from './meeting.constants';

const view = (over: Partial<MeetingRecordView> = {}): MeetingRecordView => ({
  meeting: { id: 'm1', title: 'Sprint', code: 'abc-def', startedAt: '2026-11-06T01:00:00Z', endedAt: '2026-11-06T02:00:00Z', hostName: 'Host' },
  attendees: [{ displayName: 'Alice' }],
  records: [{ kind: 'SPEECH', displayName: null, text: 'hello there', ts: '2026-11-06T01:01:00Z' }],
  chat: [{ senderName: 'Bob', content: 'hi chat', createdAt: '2026-11-06T01:02:00Z' }],
  sharedNote: 'note body',
  ...over,
});

describe('renderMeetingPrompt', () => {
  it('renders title, attendees, records, chat and note without ids', () => {
    const p = renderMeetingPrompt(view());
    expect(p).toContain('Sprint');
    expect(p).toContain('Alice');
    expect(p).toContain('hello there');
    expect(p).toContain('Bob');
    expect(p).toContain('note body');
    expect(p).not.toContain('requesterId');
  });

  it('uses the code when title is null and a generic label for null speakers', () => {
    const p = renderMeetingPrompt(view({ meeting: { ...view().meeting, title: null } }));
    expect(p).toContain('abc-def');
    expect(p).toContain('Speaker');
  });

  it('truncates over max keeping head and tail with a marker', () => {
    const records = Array.from({ length: 2000 }, (_, i) => ({
      kind: 'SPEECH' as const, displayName: 'A', text: `line-${i} ${'x'.repeat(100)}`, ts: '2026-11-06T01:01:00Z',
    }));
    const p = renderMeetingPrompt(view({ records }), 120_000);
    expect(p.length).toBeLessThanOrEqual(120_000);
    expect(p).toContain('[…]');
    expect(p).toContain('line-0 ');
    expect(p).toContain('line-1999 ');
  });
});

describe('parseMeetingSummary', () => {
  it('parses fenced JSON and normalises', () => {
    const raw = '```json\n{"overview":"o","actionItems":["do x",{"text":"y","assigneeName":""},{"text":"z","assigneeName":"Al"}]}\n```';
    expect(parseMeetingSummary(raw)).toEqual({
      overview: 'o', keyPoints: [], decisions: [],
      actionItems: [
        { text: 'do x', assigneeName: null },
        { text: 'y', assigneeName: null },
        { text: 'z', assigneeName: 'Al' },
      ],
      fromMaterials: [], language: '',
    });
  });
  it('returns null on garbage or missing overview', () => {
    expect(parseMeetingSummary('nope')).toBeNull();
    expect(parseMeetingSummary('{"keyPoints":["a"]}')).toBeNull();
  });
});
