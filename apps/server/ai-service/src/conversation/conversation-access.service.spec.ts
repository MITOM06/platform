import { Types } from 'mongoose';
import { ConversationAccessService } from './conversation-access.service';

function makeModel(doc: { participants: string[]; meetingId?: string } | null, throws = false) {
  return {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockImplementation(() =>
            throws ? Promise.reject(new Error('db down')) : Promise.resolve(doc),
          ),
        }),
      }),
    }),
  } as never;
}

const VALID_ID = new Types.ObjectId().toHexString();

describe('ConversationAccessService.checkAccess', () => {
  it('allows a participant', async () => {
    const svc = new ConversationAccessService(makeModel({ participants: ['u1', 'u2'] }));
    expect(await svc.checkAccess(VALID_ID, 'u1')).toBe('allowed');
  });

  it('denies a non-participant', async () => {
    const svc = new ConversationAccessService(makeModel({ participants: ['u2', 'u3'] }));
    expect(await svc.checkAccess(VALID_ID, 'u1')).toBe('denied');
  });

  it('is unknown for a malformed conversation id (fail-open)', async () => {
    const svc = new ConversationAccessService(makeModel(null));
    expect(await svc.checkAccess('not-an-objectid', 'u1')).toBe('unknown');
  });

  it('is unknown when the conversation is not found', async () => {
    const svc = new ConversationAccessService(makeModel(null));
    expect(await svc.checkAccess(VALID_ID, 'u1')).toBe('unknown');
  });

  it('is unknown when participants are empty (cannot assert)', async () => {
    const svc = new ConversationAccessService(makeModel({ participants: [] }));
    expect(await svc.checkAccess(VALID_ID, 'u1')).toBe('unknown');
  });

  it('is unknown (fail-open) on a DB error', async () => {
    const svc = new ConversationAccessService(makeModel(null, true));
    expect(await svc.checkAccess(VALID_ID, 'u1')).toBe('unknown');
  });
});

describe('ConversationAccessService meeting conversations', () => {
  it('meeting: chat is a shared room with the meeting id, without touching Mongo', async () => {
    const model = makeModel(null);
    const svc = new ConversationAccessService(model);
    const ctx = await svc.getConversationContext('meeting:abc123', 'u1');
    expect(ctx).toEqual({ access: 'allowed', directAi: false, meetingId: 'abc123' });
    expect((model as unknown as { findById: jest.Mock }).findById).not.toHaveBeenCalled();
  });

  it('exposes the meetingId of a post-meeting group chat', async () => {
    const svc = new ConversationAccessService(makeModel({ participants: ['u1', 'u2', 'u3'], meetingId: 'm7' }));
    expect(await svc.getConversationContext(VALID_ID, 'u1')).toEqual({
      access: 'allowed',
      directAi: false,
      meetingId: 'm7',
    });
  });

  it('meetingId is null for a normal conversation', async () => {
    const svc = new ConversationAccessService(makeModel({ participants: ['u1', 'u2', 'u3'] }));
    expect((await svc.getConversationContext(VALID_ID, 'u1')).meetingId).toBeNull();
  });
});
