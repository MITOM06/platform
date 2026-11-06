import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MeetingContextService } from './meeting-context.service';
import { MeetingRecordClient } from './meeting-record.client';
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

describe('shared contract: GET /internal/meetings/{id}/record (contracts/meeting-record.internal.json)', () => {
  // chat-service writes null fields as ABSENT (Jackson non_null), never as null:
  // InternalMeetingControllerTest pins the same fixture on the producer side.
  const fixture = JSON.parse(
    readFileSync(join(__dirname, '../../../contracts/meeting-record.internal.json'), 'utf8'),
  ) as MeetingRecordView;
  const orig = global.fetch;
  afterEach(() => {
    global.fetch = orig;
  });

  it('the fixture omits nulls instead of sending them', () => {
    expect('sharedNote' in fixture).toBe(false);
    expect('displayName' in fixture.records[3]).toBe(false);
    expect('fileName' in fixture.records[0]).toBe(false);
    expect('attachmentName' in fixture.chat[1]).toBe(false);
    expect('assigneeName' in fixture.summary!.actionItems[1]).toBe(false);
  });

  it('flows through MeetingRecordClient into a correct meeting block', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => fixture }) as unknown as typeof fetch;
    const client = new MeetingRecordClient({
      get: (k: string) =>
        k === 'config.chat.internalUrl' ? 'http://chat:8080' : k === 'config.connector.internalApiKey' ? 'k' : undefined,
    } as unknown as ConfigService);
    const block = await new MeetingContextService(client).blockFor(payload({ conversationId: 'meeting:m1' }));

    expect(block).not.toBeNull();
    const b = block as string;
    expect(b).toContain('Meeting: Q3 planning');
    expect(b).toContain('Host: Lan');
    expect(b).toContain('Ended: 2026-11-06T02:00:00Z');
    expect(b).toContain('Attendees: Lan, Binh');
    expect(b).toContain('[SPEECH] Lan: Let us ship in December.');
    expect(b).toContain('[FILE] budget.xlsx (shared by Binh): Budget: 120k');
    expect(b).toContain('[SCREEN] (shared by Lan): Slide: Q3 plan');
    // Absent displayName = a system notice, not "undefined" or a person.
    expect(b).toContain('[SCREEN] Screen reading limit reached for this meeting.');
    expect(b).toContain('Binh: [file: budget.xlsx] see the budget');
    // Absent attachmentName = no file prefix.
    expect(b).toContain('Lan: @AI what did we decide?');
    expect(b).not.toContain('## Shared note');
    expect(b).toContain('- Prepare the release notes (assignee: Binh)');
    expect(b).toMatch(/- Book the launch room\n/);
    expect(b).not.toMatch(/undefined|null/);
  });
});
