import { ConfigService } from '@nestjs/config';
import { RedisPublisherService } from './redis-publisher.service';

function make() {
  const client = { publish: jest.fn().mockResolvedValue(1) };
  const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
  const service = new RedisPublisherService(client as never, config);
  const sent = () => client.publish.mock.calls.map(([, body]) => JSON.parse(body as string));
  return { service, client, sent };
}

describe('RedisPublisherService.publish', () => {
  it('gives every AI_STREAM_DONE its own replyId, even for identical text', async () => {
    const { service, sent } = make();

    await service.publish('conv-1', { type: 'AI_STREAM_DONE', fullContent: 'Đã nhớ!' });
    await service.publish('conv-1', { type: 'AI_STREAM_DONE', fullContent: 'Đã nhớ!' });

    const [a, b] = sent();
    expect(a.replyId).toEqual(expect.any(String));
    expect(b.replyId).toEqual(expect.any(String));
    expect(a.replyId).not.toBe(b.replyId);
  });

  it('keeps a replyId the caller already set', async () => {
    const { service, sent } = make();
    await service.publish('conv-1', { type: 'AI_STREAM_DONE', fullContent: 'x', replyId: 'fixed' });
    expect(sent()[0].replyId).toBe('fixed');
  });

  it('does not add replyId to chunk or error events', async () => {
    const { service, sent } = make();
    await service.publish('conv-1', { type: 'AI_STREAM_CHUNK', chunk: 'x' });
    await service.publish('conv-1', { type: 'AI_STREAM_ERROR', error: 'e' });
    expect(sent().every((e) => e.replyId === undefined)).toBe(true);
  });

  it('publishes on ai:response:{conversationId} with the conversationId', async () => {
    const { service, client } = make();
    await service.publish('conv-9', { type: 'AI_STREAM_CHUNK', chunk: 'x' });
    expect(client.publish).toHaveBeenCalledWith('ai:response:conv-9', expect.stringContaining('"conversationId":"conv-9"'));
  });
});
