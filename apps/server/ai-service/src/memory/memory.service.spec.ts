import { MemoryService } from './memory.service';
import { AiMemory } from './ai-memory.schema';

function makeModel(overrides: Partial<{
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
  deleteOne: jest.Mock;
}> = {}) {
  return {
    findOne: overrides.findOne ?? jest.fn(),
    findOneAndUpdate: overrides.findOneAndUpdate ?? jest.fn(),
    deleteOne: overrides.deleteOne ?? jest.fn(),
  };
}

describe('MemoryService', () => {
  const CONV_ID = 'conv-test';
  const USER_ID = 'user-test';

  const vectorStub = {
    retrieve: jest.fn().mockResolvedValue([]),
    nearest: jest.fn().mockResolvedValue(null),
    upsertFact: jest.fn().mockResolvedValue(undefined),
    listFacts: jest.fn().mockResolvedValue([]),
    deleteConversation: jest.fn().mockResolvedValue(undefined),
  };
  const embedStub = { embedOne: jest.fn().mockResolvedValue([0.1, 0.2]) };
  const configStub = { get: jest.fn().mockReturnValue(undefined) };

  it('getMemory — returns document when found', async () => {
    const doc = { conversationId: CONV_ID, userId: USER_ID, summary: 'hello', keyFacts: [], messageCount: 5 };
    const model = makeModel({
      findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(doc) }) }),
    });

    const service = new MemoryService(model as any, vectorStub as any, embedStub as any, configStub as any);
    const result = await service.getMemory(CONV_ID);

    expect(model.findOne).toHaveBeenCalledWith({ conversationId: CONV_ID });
    expect(result).toEqual(doc);
  });

  it('getMemory — returns null when not found', async () => {
    const model = makeModel({
      findOne: jest.fn().mockReturnValue({ lean: () => ({ exec: () => Promise.resolve(null) }) }),
    });

    const service = new MemoryService(model as any, vectorStub as any, embedStub as any, configStub as any);
    const result = await service.getMemory(CONV_ID);

    expect(result).toBeNull();
  });

  it('upsertMemory — calls findOneAndUpdate with correct params', async () => {
    const model = makeModel({
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
    });

    const service = new MemoryService(model as any, vectorStub as any, embedStub as any, configStub as any);
    await service.upsertMemory(CONV_ID, USER_ID, 'summary text', ['fact1'], 20);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { conversationId: CONV_ID },
      expect.objectContaining({ $set: expect.objectContaining({ userId: USER_ID, summary: 'summary text', messageCount: 20 }) }),
      { upsert: true, new: true },
    );
  });

  it('deleteMemory — calls deleteOne with conversationId', async () => {
    const model = makeModel({
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    const service = new MemoryService(model as any, vectorStub as any, embedStub as any, configStub as any);
    await service.deleteMemory(CONV_ID);

    expect(model.deleteOne).toHaveBeenCalledWith({ conversationId: CONV_ID });
  });

  it('retrieveRelevantFacts — queries the vector store per-user (no conversationId)', async () => {
    const model = makeModel();
    const vector = {
      ...vectorStub,
      retrieve: jest
        .fn()
        .mockResolvedValue([{ text: 'Name is Khang', createdAt: Date.now(), score: 0.9 }]),
    };
    const service = new MemoryService(model as any, vector as any, embedStub as any, configStub as any);
    const res = await service.retrieveRelevantFacts(USER_ID, [0.1, 0.2]);
    expect(vector.retrieve).toHaveBeenCalledWith(USER_ID, [0.1, 0.2], expect.any(Number));
    expect(res[0].text).toBe('Name is Khang');
  });

  it('incrementMessageCount — returns updated count', async () => {
    const updated: Partial<AiMemory> = { conversationId: CONV_ID, messageCount: 3 };
    const model = makeModel({
      findOneAndUpdate: jest.fn().mockResolvedValue(updated),
    });

    const service = new MemoryService(model as any, vectorStub as any, embedStub as any, configStub as any);
    const count = await service.incrementMessageCount(CONV_ID);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { conversationId: CONV_ID },
      { $inc: { messageCount: 1 } },
      { upsert: true, new: true },
    );
    expect(count).toBe(3);
  });
});

describe('MemoryService.addFacts — batched embedding', () => {
  const makeService = (embed: jest.Mock) => {
    const model = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };
    const vector = {
      nearest: jest.fn().mockResolvedValue(null),
      upsertFact: jest.fn().mockResolvedValue(undefined),
      listFacts: jest.fn().mockResolvedValue([]),
    };
    const service = new MemoryService(model as any, vector as any, { embed } as any, { get: jest.fn() } as any);
    return { service, vector };
  };

  it('embeds all facts in ONE call and stores each (per-fact calls hit Voyage 3 RPM)', async () => {
    const embed = jest.fn().mockResolvedValue([[1], [2], [3]]);
    const { service, vector } = makeService(embed);

    const stored = await service.addFacts('c', 'u', ['Tên là Phong', 'Thích phở', 'Học tiếng Nhật'], 's', 3);

    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledWith(['Tên là Phong', 'Thích phở', 'Học tiếng Nhật']);
    expect(vector.upsertFact).toHaveBeenCalledTimes(3);
    expect(vector.upsertFact.mock.calls[1][2]).toMatchObject({ text: 'Thích phở', vector: [2] });
    expect(stored).toBe(3);
  });

  it('stores nothing (no throw) when the embedding call fails', async () => {
    const embed = jest.fn().mockRejectedValue(new Error('Voyage embeddings 500'));
    const { service, vector } = makeService(embed);

    await expect(service.addFacts('c', 'u', ['a', 'b'], 's', 3)).resolves.toBe(0);
    expect(vector.upsertFact).not.toHaveBeenCalled();
  });

  it('skips blank facts before embedding', async () => {
    const embed = jest.fn().mockResolvedValue([[1]]);
    const { service } = makeService(embed);

    await service.addFacts('c', 'u', ['  ', 'Thích phở', ''], 's', 3);
    expect(embed).toHaveBeenCalledWith(['Thích phở']);
  });
});

describe('MemoryService.addFacts — 429 handling', () => {
  const make = (embed: jest.Mock) => {
    const vector = {
      nearest: jest.fn().mockResolvedValue(null),
      upsertFact: jest.fn().mockResolvedValue(undefined),
      listFacts: jest.fn().mockResolvedValue([]),
    };
    const service = new MemoryService(
      { findOneAndUpdate: jest.fn().mockResolvedValue({}) } as any,
      vector as any,
      { embed } as any,
      { get: jest.fn() } as any,
    );
    service.retryDelaysMs = [0, 0];
    return { service, vector };
  };
  const rateLimited = () => new Error('Voyage embeddings 429: reduced rate limits of 3 RPM');

  it('background extraction waits out a 429 and still stores the facts', async () => {
    const embed = jest.fn().mockRejectedValueOnce(rateLimited()).mockResolvedValueOnce([[1], [2]]);
    const { service, vector } = make(embed);

    await expect(service.addFacts('c', 'u', ['Nuôi chó tên Bơ', 'Chơi cầu lông'], 's', 3)).resolves.toBe(2);
    expect(embed).toHaveBeenCalledTimes(2);
    expect(vector.upsertFact).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget', async () => {
    const embed = jest.fn().mockRejectedValue(rateLimited());
    const { service } = make(embed);

    await expect(service.addFacts('c', 'u', ['a'], 's', 3)).resolves.toBe(0);
    expect(embed).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-429 errors', async () => {
    const embed = jest.fn().mockRejectedValue(new Error('Voyage embeddings 500'));
    const { service } = make(embed);

    await service.addFacts('c', 'u', ['a'], 's', 3);
    expect(embed).toHaveBeenCalledTimes(1);
  });

  it('remember_fact (user-requested) fails fast instead of stalling the live reply', async () => {
    const embed = jest.fn().mockRejectedValue(rateLimited());
    const { service } = make(embed);

    await expect(service.addFacts('c', 'u', ['a'], 's', 3, 'user-requested')).resolves.toBe(0);
    expect(embed).toHaveBeenCalledTimes(1);
  });
});
