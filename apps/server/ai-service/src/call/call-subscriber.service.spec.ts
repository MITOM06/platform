import { CallSubscriberService } from './call-subscriber.service';

function make(subscribe = jest.fn().mockResolvedValue(1)) {
  const client = { subscribe, on: jest.fn() };
  const summarize = jest.fn().mockResolvedValue(undefined);
  const svc = new CallSubscriberService(client as never, { summarize } as never);
  const deliver = (channel: string, message: string) => client.on.mock.calls[0][1](channel, message);
  return { svc, client, summarize, deliver };
}

describe('CallSubscriberService', () => {
  it('subscribes to call:summarize and dispatches a valid message', async () => {
    const m = make();
    await m.svc.onApplicationBootstrap();
    expect(m.client.subscribe).toHaveBeenCalledWith('call:summarize');
    m.deliver('call:summarize', JSON.stringify({ callId: 'c1', conversationId: 'conv' }));
    expect(m.summarize).toHaveBeenCalledWith({ callId: 'c1', conversationId: 'conv' });
  });

  it.each([
    ['another channel', 'kb:process', JSON.stringify({ callId: 'c1', conversationId: 'conv' })],
    ['malformed JSON', 'call:summarize', '{oops'],
    ['missing callId', 'call:summarize', JSON.stringify({ conversationId: 'conv' })],
    ['missing conversationId', 'call:summarize', JSON.stringify({ callId: 'c1' })],
    ['JSON null', 'call:summarize', 'null'],
  ])('ignores %s without throwing', async (_label, channel, message) => {
    const m = make();
    await m.svc.onApplicationBootstrap();
    expect(() => m.deliver(channel, message)).not.toThrow();
    expect(m.summarize).not.toHaveBeenCalled();
  });

  it('keeps listening when SUBSCRIBE fails and a summary job rejects', async () => {
    const m = make(jest.fn().mockRejectedValue(new Error('NOAUTH')));
    m.summarize.mockRejectedValue(new Error('boom'));
    await expect(m.svc.onApplicationBootstrap()).resolves.toBeUndefined();
    m.deliver('call:summarize', JSON.stringify({ callId: 'c1', conversationId: 'conv' }));
    await new Promise((r) => setImmediate(r));
    expect(m.summarize).toHaveBeenCalledTimes(1);
  });
});
