import { ListMyMeetingsTool } from './list-my-meetings.tool';
import { GetMeetingRecordTool } from './get-meeting-record.tool';
import { isCacheableTool } from './tool-registry.service';
import { ToolContext } from './tool.interface';
import { MeetingRecordView } from '../meeting/meeting.constants';

const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({
  conversationId: 'c1', userId: 'u1', displayName: 'A', directAi: true, ...over,
});

const view = (over: Partial<MeetingRecordView> = {}): MeetingRecordView => ({
  meeting: { id: 'm1', title: 'Họp kế hoạch', code: 'abc', startedAt: null, endedAt: null, hostName: null },
  attendees: [],
  records: [
    { kind: 'SPEECH', displayName: 'Lan', text: 'Chúng ta quyết định ngân sách quý tới', ts: '' },
    { kind: 'SPEECH', displayName: 'Nam', text: 'Hôm nay trời đẹp', ts: '' },
  ],
  chat: [],
  sharedNote: null,
  ...over,
});

describe('ListMyMeetingsTool', () => {
  it('lists via ctx.userId, ignoring any userId in input', async () => {
    const client = { listMine: jest.fn().mockResolvedValue([
      { id: 'm1', title: 'Weekly', code: 'c', startedAt: 's', endedAt: 'e', summaryState: 'DONE' },
      { id: 'm2', code: 'c2', startedAt: 's', endedAt: 'e', summaryState: 'PENDING' },
    ]) };
    const out = await new ListMyMeetingsTool(client as any).execute({ query: 'week', userId: 'evil' }, ctx());
    expect(client.listMine).toHaveBeenCalledWith('u1', 'week');
    expect(out).toContain('UNTRUSTED_DATA');
    const rows = JSON.parse(out.split('\n').filter((l) => l.startsWith('['))[0]);
    expect(rows[0]).toEqual({ meetingId: 'm1', title: 'Weekly', startedAt: 's', endedAt: 'e', hasSummary: true });
    expect(rows[1].hasSummary).toBe(false);
    expect(rows[1].title).toBe('c2');
  });
  it('empty -> No meetings found.; outage -> unavailable; not direct -> not found', async () => {
    const client = { listMine: jest.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('x')) };
    const t = new ListMyMeetingsTool(client as any);
    expect(await t.execute({}, ctx())).toBe('No meetings found.');
    expect(await t.execute({}, ctx())).toBe('Meeting records are temporarily unavailable.');
    expect(await t.execute({}, ctx({ directAi: false }))).toBe('Meeting not found.');
    expect(client.listMine).toHaveBeenCalledTimes(2);
  });
});

describe('GetMeetingRecordTool', () => {
  const make = (v: MeetingRecordView | null | Error) =>
    new GetMeetingRecordTool({
      fetch: jest.fn(async () => { if (v instanceof Error) throw v; return v; }),
    } as any);

  it('uses ctx.userId; null / invalid id / not direct -> Meeting not found.', async () => {
    const fetch = jest.fn().mockResolvedValue(null);
    const t = new GetMeetingRecordTool({ fetch } as any);
    expect(await t.execute({ meetingId: 'm1', userId: 'evil' }, ctx())).toBe('Meeting not found.');
    expect(fetch).toHaveBeenCalledWith('m1', 'u1');
    for (const bad of ['', 'a/b', 'x'.repeat(65), 5, undefined]) {
      expect(await t.execute({ meetingId: bad }, ctx())).toBe('Meeting not found.');
    }
    expect(await t.execute({ meetingId: 'm1' }, ctx({ directAi: false }))).toBe('Meeting not found.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('fetch error -> unavailable', async () => {
    expect(await make(new Error('x')).execute({ meetingId: 'm1' }, ctx())).toBe('Meeting records are temporarily unavailable.');
  });
  it('summary first, whole record without question', async () => {
    const out = await make(view({ summary: { overview: 'Tổng quan X', keyPoints: [], decisions: [], actionItems: [] } as any }))
      .execute({ meetingId: 'm1' }, ctx());
    expect(out).toContain('Meeting record');
    expect(out.indexOf('Tổng quan X')).toBeLessThan(out.indexOf('ngân sách'));
    expect(out).toContain('trời đẹp');
  });
  it('keeps the summary when the overview is blank but decisions exist', async () => {
    const out = await make(view({ summary: { overview: '', keyPoints: [], decisions: ['Chốt ngân sách'], actionItems: [] } as any }))
      .execute({ meetingId: 'm1' }, ctx());
    expect(out).toContain('AI summary');
    expect(out).toContain('Chốt ngân sách');
  });
  it('marks the turn as having read meeting content (blocks key-fact extraction)', async () => {
    const c = ctx();
    await make(view()).execute({ meetingId: 'm1' }, c);
    expect(c.meetingContentRead).toBe(true);
    const c2 = ctx();
    await new ListMyMeetingsTool({ listMine: jest.fn().mockResolvedValue([]) } as any).execute({}, c2);
    expect(c2.meetingContentRead).toBe(true);
    const c3 = ctx({ directAi: false });
    await make(view()).execute({ meetingId: 'm1' }, c3);
    expect(c3.meetingContentRead).toBeUndefined();
  });
  it('question keeps only matching lines (Vietnamese diacritics, case-insensitive)', async () => {
    const out = await make(view()).execute({ meetingId: 'm1', question: 'NGÂN SÁCH?' }, ctx());
    expect(out).toContain('ngân sách');
    expect(out).not.toContain('trời đẹp');
  });
  it('caps at 30000 chars of content', async () => {
    const big = view({ records: [{ kind: 'SPEECH', displayName: 'L', text: 'a'.repeat(100_000), ts: '' }] });
    const out = await make(big).execute({ meetingId: 'm1' }, ctx());
    expect(out.length).toBeLessThan(31_000);
  });
});

describe('meeting tools in the registry cache', () => {
  it('are never result-cached', () => {
    expect(isCacheableTool('list_my_meetings')).toBe(false);
    expect(isCacheableTool('get_meeting_record')).toBe(false);
  });
});
