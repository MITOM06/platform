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
