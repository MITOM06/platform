import { MeetingSubscriberService } from './meeting-subscriber.service';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const good = { meetingId: 'm', messageId: 'x', uploadId: UUID, fileName: 'a.pdf', mimeType: null, userId: 'u' };

async function boot() {
  let handler: (c: string, m: string) => void = () => undefined;
  const client = { subscribe: jest.fn().mockResolvedValue(2), on: jest.fn((_e: string, h: typeof handler) => { handler = h; }) };
  const summary = { summarize: jest.fn().mockResolvedValue(undefined) };
  const material = { process: jest.fn().mockResolvedValue(undefined) };
  await new MeetingSubscriberService(client as never, summary as never, material as never).onApplicationBootstrap();
  return { client, summary, material, emit: (c: string, p: unknown) => handler(c, typeof p === 'string' ? p : JSON.stringify(p)) };
}

describe('MeetingSubscriberService', () => {
  it('subscribes to both channels', async () => {
    const t = await boot();
    expect(t.client.subscribe).toHaveBeenCalledWith('meet:summarize', 'meet:material');
  });
  it('routes meet:material to the material service and summarize to the summary service', async () => {
    const t = await boot();
    t.emit('meet:material', good);
    t.emit('meet:summarize', { meetingId: 'm', attempt: 'a', requesterId: 'r' });
    expect(t.material.process).toHaveBeenCalledWith(good);
    expect(t.summary.summarize).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['bad json', '{nope'],
    ['bad upload id', { ...good, uploadId: '../x' }],
    ['empty fileName', { ...good, fileName: ' ' }],
    ['missing userId', { ...good, userId: undefined }],
    ['non-string mime', { ...good, mimeType: 5 }],
    ['unknown kind', { ...good, kind: 'video' }],
    ['non-string kind', { ...good, kind: 5 }],
  ])('drops malformed material: %s', async (_n, p) => {
    const t = await boot();
    t.emit('meet:material', p);
    expect(t.material.process).not.toHaveBeenCalled();
  });
  it.each([['file'], ['screen'], [undefined]])('accepts kind %s', async (kind) => {
    const t = await boot();
    t.emit('meet:material', { ...good, kind });
    expect(t.material.process).toHaveBeenCalledTimes(1);
  });
});
