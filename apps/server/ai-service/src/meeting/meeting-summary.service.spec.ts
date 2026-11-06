import { MeetingSummaryService } from './meeting-summary.service';
import { MEETING_SUMMARY_RESULT_CHANNEL, MeetingRecordView } from './meeting.constants';

const full: MeetingRecordView = {
  meeting: { id: 'm1', title: 'T', code: 'c', startedAt: null, endedAt: null, hostName: 'H' },
  attendees: [],
  records: [{ kind: 'SPEECH', displayName: 'A', text: 'hi', ts: '2026-11-06T01:00:00Z' }],
  chat: [],
  sharedNote: null,
};
const msg = { meetingId: 'm1', attempt: 'a1', requesterId: 'host' };

function setup(opts: { claim?: string | null; view?: MeetingRecordView | null | Error; model?: string | Error } = {}) {
  const redis = { set: jest.fn().mockResolvedValue(opts.claim === undefined ? 'OK' : opts.claim) };
  const publisher = { publishToChannel: jest.fn().mockResolvedValue(undefined) };
  const client = {
    fetch: jest.fn().mockImplementation(async () => {
      const v = opts.view === undefined ? full : opts.view;
      if (v instanceof Error) throw v;
      return v;
    }),
  };
  const usage = { recordModelCall: jest.fn() };
  const config = { get: (k: string) => (k === 'config.anthropic.model' ? 'm-x' : undefined) };
  const svc = new MeetingSummaryService(redis as never, publisher as never, config as never, client as never, usage as never);
  const create = jest.fn().mockImplementation(async () => {
    if (opts.model instanceof Error) throw opts.model;
    return { content: [{ type: 'text', text: opts.model ?? '{"overview":"ok"}' }], usage: {} };
  });
  (svc as unknown as { anthropic: unknown }).anthropic = { messages: { create } };
  return { svc, redis, publisher, client, create, usage };
}

describe('MeetingSummaryService.summarize', () => {
  it('claims with NX/EX and skips everything when the claim is lost', async () => {
    const s = setup({ claim: null });
    await s.svc.summarize(msg);
    expect(s.redis.set).toHaveBeenCalledWith('meet:summarize:claim:m1:a1', '1', 'EX', 3600, 'NX');
    expect(s.client.fetch).not.toHaveBeenCalled();
    expect(s.publisher.publishToChannel).not.toHaveBeenCalled();
  });
  it('publishes empty without calling the model', async () => {
    const s = setup({ view: { ...full, records: [], sharedNote: '  ' } });
    await s.svc.summarize(msg);
    expect(s.create).not.toHaveBeenCalled();
    expect(s.publisher.publishToChannel).toHaveBeenCalledWith(MEETING_SUMMARY_RESULT_CHANNEL, { meetingId: 'm1', attempt: 'a1', status: 'empty' });
  });
  it.each([['null', null], ['throw', new Error('x')]])('fetch %s -> failed', async (_n, view) => {
    const s = setup({ view });
    await s.svc.summarize(msg);
    expect(s.publisher.publishToChannel).toHaveBeenCalledWith(MEETING_SUMMARY_RESULT_CHANNEL, { meetingId: 'm1', attempt: 'a1', status: 'failed' });
  });
  it('broken model JSON or model error -> failed', async () => {
    for (const model of ['not json', new Error('boom')]) {
      const s = setup({ model });
      await s.svc.summarize(msg);
      expect(s.publisher.publishToChannel).toHaveBeenCalledWith(MEETING_SUMMARY_RESULT_CHANNEL, { meetingId: 'm1', attempt: 'a1', status: 'failed' });
    }
  });
  it('fenced JSON -> ok with normalised summary and usage recorded', async () => {
    const s = setup({ model: '```json\n{"overview":"o","actionItems":["a"]}\n```' });
    await s.svc.summarize(msg);
    expect(s.publisher.publishToChannel).toHaveBeenCalledWith(MEETING_SUMMARY_RESULT_CHANNEL, {
      meetingId: 'm1', attempt: 'a1', status: 'ok',
      summary: { overview: 'o', keyPoints: [], decisions: [], actionItems: [{ text: 'a', assigneeName: null }], fromMaterials: [], language: '' },
    });
    expect(s.usage.recordModelCall).toHaveBeenCalled();
    expect(s.create.mock.calls[0][0].model).toBe('m-x');
  });
});
