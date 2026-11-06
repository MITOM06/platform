import { MeetingContextService } from './meeting-context.service';
import { AiRequestPayload } from '../ai/ai.types';
import { MeetingRecordView } from './meeting.constants';

const payload = (over: Partial<AiRequestPayload> = {}): AiRequestPayload => ({
  conversationId: 'c1',
  userId: 'u1',
  displayName: 'Alice',
  content: 'what was decided?',
  history: [],
  ...over,
});

const VIEW: MeetingRecordView = {
  meeting: { id: 'm1', title: 'T', code: 'c', startedAt: null, endedAt: null, hostName: null },
  attendees: [],
  records: [{ kind: 'SPEECH', displayName: 'Lan', text: 'secret-content-xyz', ts: 't' }],
  chat: [],
  sharedNote: null,
};

describe('MeetingContextService.blockFor', () => {
  it('returns null and does not fetch without a meeting id', async () => {
    const fetch = jest.fn();
    const svc = new MeetingContextService({ fetch } as never);
    expect(await svc.blockFor(payload(), null)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('meeting: chat takes the id from the conversation id, ignoring a mismatching payload id', async () => {
    const fetch = jest.fn().mockResolvedValue(VIEW);
    const svc = new MeetingContextService({ fetch } as never);
    await svc.blockFor(payload({ conversationId: 'meeting:m1', meetingId: 'evil' }), 'm1');
    expect(fetch).toHaveBeenCalledWith('m1', 'u1');
    await svc.blockFor(payload({ conversationId: 'meeting:m2', meetingId: 'm2' }), 'whatever');
    expect(fetch).toHaveBeenLastCalledWith('m2', 'u1');
  });

  it('other conversations ignore payload.meetingId and use only the conversation meetingId', async () => {
    const fetch = jest.fn().mockResolvedValue(VIEW);
    const svc = new MeetingContextService({ fetch } as never);
    expect(await svc.blockFor(payload({ meetingId: 'forged' }), null)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    await svc.blockFor(payload({ meetingId: 'forged' }), 'm9');
    expect(fetch).toHaveBeenCalledWith('m9', 'u1');
  });

  it('null record -> trusted no-access block without content', async () => {
    const svc = new MeetingContextService({ fetch: jest.fn().mockResolvedValue(null) } as never);
    const block = await svc.blockFor(payload({ conversationId: 'meeting:m1' }), null);
    expect(block).toContain(
      "The requester has no access to this meeting's record; do not reveal or guess its content.",
    );
    expect(block).not.toContain('secret-content-xyz');
  });

  it('fetch error -> temporarily unavailable block', async () => {
    const svc = new MeetingContextService({ fetch: jest.fn().mockRejectedValue(new Error('boom')) } as never);
    const block = await svc.blockFor(payload({ conversationId: 'meeting:m1' }), null);
    expect(block).toContain('The meeting record is temporarily unavailable; do not reveal or guess its content.');
    expect(block).not.toContain('boom');
  });
});
