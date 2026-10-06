import { AI_MEMORY_DELETE_CHANNEL, RedisSubscriberService } from './redis-subscriber.service';

function make() {
  const forgetConversation = jest.fn().mockResolvedValue(true);
  const svc = new RedisSubscriberService(
    { subscribe: jest.fn(), on: jest.fn() } as any,
    { processDocument: jest.fn().mockResolvedValue(undefined) } as any,
    { deleteDocument: jest.fn().mockResolvedValue(undefined) } as any,
    { get: () => undefined } as any,
    { forgetConversation } as any,
  );
  return { svc, forgetConversation };
}

describe('RedisSubscriberService — ai:memory:delete', () => {
  it("forgets the given user's memory of the conversation", async () => {
    const { svc, forgetConversation } = make();
    svc.onMessage(AI_MEMORY_DELETE_CHANNEL, JSON.stringify({ conversationId: 'c1', userId: 'u1' }));
    expect(forgetConversation).toHaveBeenCalledWith('c1', 'u1');
  });

  it('subscribes to the channel on bootstrap', async () => {
    const client = { subscribe: jest.fn().mockResolvedValue(3), on: jest.fn() };
    const svc = new RedisSubscriberService(client as any, {} as any, {} as any, { get: () => undefined } as any, {} as any);
    await svc.onApplicationBootstrap();
    expect(client.subscribe).toHaveBeenCalledWith('kb:process', 'kb:delete', AI_MEMORY_DELETE_CHANNEL);
  });

  it.each([
    ['malformed JSON', 'not json'],
    ['missing userId (would wipe every member)', JSON.stringify({ conversationId: 'c1' })],
    ['missing conversationId', JSON.stringify({ userId: 'u1' })],
  ])('ignores %s without throwing', (_name, message) => {
    const { svc, forgetConversation } = make();
    expect(() => svc.onMessage(AI_MEMORY_DELETE_CHANNEL, message)).not.toThrow();
    expect(forgetConversation).not.toHaveBeenCalled();
  });
});
