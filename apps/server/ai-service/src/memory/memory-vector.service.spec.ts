import { MemoryVectorService } from './memory-vector.service';

function svcWith(searchImpl: any) {
  const config = { get: () => undefined } as any;
  const s = new MemoryVectorService(config);
  // Replace the private client with a mock (cast through any).
  (s as any).client = {
    getCollection: jest.fn().mockResolvedValue({}),
    search: searchImpl,
    scroll: jest.fn().mockResolvedValue({ points: [] }),
  };
  (s as any).ensured = true;
  return s;
}

describe('MemoryVectorService — per-user scope', () => {
  it('retrieve filters by userId only (no conversationId)', async () => {
    const search = jest.fn().mockResolvedValue([]);
    const s = svcWith(search);
    await s.retrieve('u1', [0.1, 0.2], 5);
    const filter = search.mock.calls[0][1].filter;
    expect(filter.must).toEqual([{ key: 'userId', match: { value: 'u1' } }]);
  });

  it('nearest filters by userId only', async () => {
    const search = jest.fn().mockResolvedValue([]);
    const s = svcWith(search);
    await s.nearest('u1', [0.1, 0.2]);
    const filter = search.mock.calls[0][1].filter;
    expect(filter.must).toEqual([{ key: 'userId', match: { value: 'u1' } }]);
  });
});

describe('MemoryVectorService — memory delete scope', () => {
  function svcWithDelete(deleteImpl: jest.Mock) {
    const s = new MemoryVectorService({ get: () => undefined } as any);
    (s as any).client = { getCollection: jest.fn().mockResolvedValue({}), delete: deleteImpl };
    (s as any).ensured = true;
    return s;
  }

  it("deleteUserConversation filters by BOTH userId and conversationId (other members' facts survive)", async () => {
    const del = jest.fn().mockResolvedValue({});
    const s = svcWithDelete(del);

    await expect(s.deleteUserConversation('u1', 'group-1')).resolves.toBe(true);

    expect(del).toHaveBeenCalledWith('ai_memory', {
      wait: true,
      filter: {
        must: [
          { key: 'userId', match: { value: 'u1' } },
          { key: 'conversationId', match: { value: 'group-1' } },
        ],
      },
    });
  });

  it('deleteUserConversation reports failure instead of throwing', async () => {
    const s = svcWithDelete(jest.fn().mockRejectedValue(new Error('qdrant down')));
    await expect(s.deleteUserConversation('u1', 'c1')).resolves.toBe(false);
  });
});

describe('MemoryVectorService — reads, writes and fail-soft', () => {
  function svcWithClient(client: Record<string, jest.Mock>, ensured = true) {
    const s = new MemoryVectorService({ get: () => undefined } as any);
    (s as any).client = { getCollection: jest.fn().mockResolvedValue({}), ...client };
    (s as any).ensured = ensured;
    return s;
  }

  it('retrieve maps payloads and fills defaults for missing fields', async () => {
    const search = jest.fn().mockResolvedValue([
      { id: 7, score: 0.9, payload: { text: 'likes tea', createdAt: 5, source: 'explicit' } },
      { id: 'x', score: 0.5, payload: {} },
    ]);
    const s = svcWithClient({ search });
    await expect(s.retrieve('u1', [0.1], 2)).resolves.toEqual([
      { id: '7', text: 'likes tea', score: 0.9, createdAt: 5, source: 'explicit' },
      { id: 'x', text: '', score: 0.5, createdAt: 0, source: 'unknown' },
    ]);
    expect(search.mock.calls[0][1]).toMatchObject({ limit: 2, with_payload: true });
  });

  it('retrieve and nearest return nothing on a Qdrant error', async () => {
    const s = svcWithClient({ search: jest.fn().mockRejectedValue(new Error('down')) });
    await expect(s.retrieve('u1', [0.1], 3)).resolves.toEqual([]);
    await expect(s.nearest('u1', [0.1])).resolves.toBeNull();
  });

  it('nearest returns null for an empty collection and the top hit otherwise', async () => {
    const search = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: 'p1', score: 0.97, payload: { text: 't', createdAt: 1, source: 's' } },
    ]);
    const s = svcWithClient({ search });
    await expect(s.nearest('u1', [0.1])).resolves.toBeNull();
    await expect(s.nearest('u1', [0.1])).resolves.toEqual({
      id: 'p1', text: 't', score: 0.97, createdAt: 1, source: 's',
    });
  });

  it('upsertFact stores the owner userId + conversationId in the payload', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const s = svcWithClient({ upsert });
    await s.upsertFact('u1', 'c1', { text: 'fact', vector: [1, 2], source: 'auto', createdAt: 42, id: 'fixed' });
    expect(upsert).toHaveBeenCalledWith('ai_memory', {
      wait: true,
      points: [
        {
          id: 'fixed',
          vector: [1, 2],
          payload: { userId: 'u1', conversationId: 'c1', text: 'fact', source: 'auto', createdAt: 42 },
        },
      ],
    });
  });

  it('upsertFact generates an id and timestamp when absent, and swallows errors', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const s = svcWithClient({ upsert });
    await s.upsertFact('u1', 'c1', { text: 'f', vector: [1], source: 'auto' });
    const point = upsert.mock.calls[0][1].points[0];
    expect(point.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof point.payload.createdAt).toBe('number');

    const failing = svcWithClient({ upsert: jest.fn().mockRejectedValue(new Error('down')) });
    await expect(failing.upsertFact('u1', 'c1', { text: 'f', vector: [1], source: 'a' })).resolves.toBeUndefined();
  });

  it('listFacts scrolls only the user’s own points', async () => {
    const scroll = jest.fn().mockResolvedValue({
      points: [{ id: 1, payload: { text: 'a', createdAt: 3, source: 's' } }],
    });
    const s = svcWithClient({ scroll });
    await expect(s.listFacts('u1')).resolves.toEqual([
      { id: '1', text: 'a', score: 0, createdAt: 3, source: 's' },
    ]);
    expect(scroll.mock.calls[0][1].filter).toEqual({ must: [{ key: 'userId', match: { value: 'u1' } }] });
  });

  it('listFacts returns [] on error or missing points', async () => {
    await expect(svcWithClient({ scroll: jest.fn().mockResolvedValue({}) }).listFacts('u1')).resolves.toEqual([]);
    await expect(
      svcWithClient({ scroll: jest.fn().mockRejectedValue(new Error('x')) }).listFacts('u1'),
    ).resolves.toEqual([]);
  });

  it('deleteOlderThan deletes by createdAt and reports success / failure', async () => {
    const del = jest.fn().mockResolvedValue({});
    await expect(svcWithClient({ delete: del }).deleteOlderThan(1000)).resolves.toBe(true);
    expect(del).toHaveBeenCalledWith('ai_memory', {
      wait: true,
      filter: { must: [{ key: 'createdAt', range: { lt: 1000 } }] },
    });
    await expect(
      svcWithClient({ delete: jest.fn().mockRejectedValue(new Error('x')) }).deleteOlderThan(1),
    ).resolves.toBe(false);
  });

  describe('ensureCollection', () => {
    it('creates the collection sized to the vector on first use, then caches', async () => {
      const getCollection = jest.fn().mockRejectedValue(new Error('404'));
      const createCollection = jest.fn().mockResolvedValue(true);
      const search = jest.fn().mockResolvedValue([]);
      const s = svcWithClient({ getCollection, createCollection, search }, false);
      await s.retrieve('u1', [1, 2, 3], 1);
      await s.retrieve('u1', [1, 2, 3], 1);
      expect(createCollection).toHaveBeenCalledTimes(1);
      expect(createCollection).toHaveBeenCalledWith('ai_memory', { vectors: { size: 3, distance: 'Cosine' } });
      expect(getCollection).toHaveBeenCalledTimes(1);
    });

    it('retries ensuring next time when creation failed (not cached)', async () => {
      const getCollection = jest.fn().mockRejectedValue(new Error('404'));
      const createCollection = jest.fn().mockRejectedValue(new Error('denied'));
      const scroll = jest.fn().mockResolvedValue({ points: [] });
      const s = svcWithClient({ getCollection, createCollection, scroll }, false);
      await s.listFacts('u1');
      await s.listFacts('u1');
      expect(createCollection).toHaveBeenCalledTimes(2);
      expect(createCollection.mock.calls[0][1]).toEqual({ vectors: { size: 1024, distance: 'Cosine' } });
    });
  });
});
