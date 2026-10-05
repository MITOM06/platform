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
