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
