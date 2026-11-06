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

describe('MeetingSubscriberService — meet:summarize validation and resilience', () => {
  it.each([
    ['bad json', '{nope'],
    ['JSON null', 'null'],
    ['missing meetingId', { attempt: 'a', requesterId: 'r' }],
    ['empty attempt', { meetingId: 'm', attempt: '', requesterId: 'r' }],
    ['numeric attempt', { meetingId: 'm', attempt: 1, requesterId: 'r' }],
    ['missing requesterId', { meetingId: 'm', attempt: 'a' }],
  ])('drops malformed summarize: %s', async (_n, p) => {
    const t = await boot();
    t.emit('meet:summarize', p);
    expect(t.summary.summarize).not.toHaveBeenCalled();
  });

  it('passes the summarize payload through unchanged', async () => {
    const t = await boot();
    const p = { meetingId: 'm', attempt: 'a', requesterId: 'host' };
    t.emit('meet:summarize', p);
    expect(t.summary.summarize).toHaveBeenCalledWith(p);
  });

  it('ignores other channels', async () => {
    const t = await boot();
    t.emit('kb:process', { meetingId: 'm', attempt: 'a', requesterId: 'r' });
    expect(t.summary.summarize).not.toHaveBeenCalled();
    expect(t.material.process).not.toHaveBeenCalled();
  });

  it('keeps listening when SUBSCRIBE fails and a job rejects', async () => {
    let handler: (c: string, m: string) => void = () => undefined;
    const client = {
      subscribe: jest.fn().mockRejectedValue(new Error('NOAUTH')),
      on: jest.fn((_e: string, h: typeof handler) => { handler = h; }),
    };
    const summary = { summarize: jest.fn().mockRejectedValue(new Error('x')) };
    const material = { process: jest.fn().mockRejectedValue(new Error('y')) };
    const svc = new MeetingSubscriberService(client as never, summary as never, material as never);
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
    handler('meet:summarize', JSON.stringify({ meetingId: 'm', attempt: 'a', requesterId: 'r' }));
    handler('meet:material', JSON.stringify(good));
    await new Promise((r) => setImmediate(r));
    expect(summary.summarize).toHaveBeenCalledTimes(1);
    expect(material.process).toHaveBeenCalledTimes(1);
  });
});
