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

describe('RedisSubscriberService — knowledge-base channels', () => {
  const flush = () => new Promise((r) => setImmediate(r));

  function makeKb(opts: { processError?: Error; deleteError?: Error; collection?: string } = {}) {
    const processDocument = opts.processError
      ? jest.fn().mockRejectedValue(opts.processError)
      : jest.fn().mockResolvedValue(undefined);
    const deleteDocument = opts.deleteError
      ? jest.fn().mockRejectedValue(opts.deleteError)
      : jest.fn().mockResolvedValue(undefined);
    const svc = new RedisSubscriberService(
      { subscribe: jest.fn(), on: jest.fn() } as any,
      { processDocument } as any,
      { deleteDocument } as any,
      { get: (k: string) => (k === 'config.kb.qdrantCollection' ? opts.collection : undefined) } as any,
      { forgetConversation: jest.fn() } as any,
    );
    return { svc, processDocument, deleteDocument };
  }

  it('hands a kb:process payload to the processor', () => {
    const { svc, processDocument } = makeKb();
    const payload = { documentId: 'd1', conversationId: 'c1', fileUrl: '/api/uploads/x' };
    svc.onMessage('kb:process', JSON.stringify(payload));
    expect(processDocument).toHaveBeenCalledWith(payload);
  });

  it('survives a malformed kb:process message and a rejected processing job', async () => {
    const { svc, processDocument } = makeKb({ processError: new Error('boom') });
    expect(() => svc.onMessage('kb:process', '{not json')).not.toThrow();
    expect(processDocument).not.toHaveBeenCalled();
    svc.onMessage('kb:process', '{}');
    await flush();
    expect(processDocument).toHaveBeenCalledTimes(1);
  });

  it('deletes a document’s vectors from the configured collection', () => {
    const { svc, deleteDocument } = makeKb({ collection: 'kb-prod' });
    svc.onMessage('kb:delete', JSON.stringify({ documentId: 'd9' }));
    expect(deleteDocument).toHaveBeenCalledWith('kb-prod', 'd9');
  });

  it('survives a malformed kb:delete message and a failed vector delete', async () => {
    const { svc, deleteDocument } = makeKb({ deleteError: new Error('qdrant down') });
    expect(() => svc.onMessage('kb:delete', 'nope')).not.toThrow();
    expect(deleteDocument).not.toHaveBeenCalled();
    svc.onMessage('kb:delete', JSON.stringify({ documentId: 'd1' }));
    await flush();
    expect(deleteDocument).toHaveBeenCalledWith('knowledge', 'd1');
  });

  it('ignores unknown channels', () => {
    const { svc, processDocument, deleteDocument } = makeKb();
    svc.onMessage('other', JSON.stringify({ documentId: 'd1' }));
    expect(processDocument).not.toHaveBeenCalled();
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it('a memory delete that reports false or rejects never throws', async () => {
    const forgetConversation = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('qdrant'));
    const svc = new RedisSubscriberService(
      { subscribe: jest.fn(), on: jest.fn() } as any,
      {} as any,
      {} as any,
      { get: () => undefined } as any,
      { forgetConversation } as any,
    );
    svc.onMessage(AI_MEMORY_DELETE_CHANNEL, JSON.stringify({ conversationId: 'c', userId: 'u' }));
    svc.onMessage(AI_MEMORY_DELETE_CHANNEL, JSON.stringify({ conversationId: 'c', userId: 'u' }));
    await flush();
    expect(forgetConversation).toHaveBeenCalledTimes(2);
  });

  it('still registers the message listener when SUBSCRIBE fails, and routes through onMessage', async () => {
    const client = { subscribe: jest.fn().mockRejectedValue(new Error('NOAUTH')), on: jest.fn() };
    const processDocument = jest.fn().mockResolvedValue(undefined);
    const svc = new RedisSubscriberService(
      client as any,
      { processDocument } as any,
      {} as any,
      { get: () => undefined } as any,
      {} as any,
    );
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(client.on).toHaveBeenCalledWith('message', expect.any(Function));
    client.on.mock.calls[0][1]('kb:process', '{"documentId":"d"}');
    expect(processDocument).toHaveBeenCalledWith({ documentId: 'd' });
  });
});
