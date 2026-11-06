import { VectorStoreService } from './vector-store.service';
import { ConfigService } from '@nestjs/config';

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    getCollection: jest.fn(),
    createCollection: jest.fn(),
    upsert: jest.fn(),
    search: jest.fn(),
    delete: jest.fn(),
  })),
}));

import { QdrantClient } from '@qdrant/js-client-rest';

describe('VectorStoreService', () => {
  let service: VectorStoreService;
  let mockClient: jest.Mocked<InstanceType<typeof QdrantClient>>;

  beforeEach(() => {
    const fakeConfig = {
      get: jest.fn().mockReturnValue('http://localhost:6333'),
    } as unknown as ConfigService;
    service = new VectorStoreService(fakeConfig);
    mockClient = (service as any)['client'];
    jest.clearAllMocks();
  });

  it('ensureCollection creates collection when not found', async () => {
    mockClient.getCollection.mockRejectedValue(new Error('not found'));
    mockClient.createCollection.mockResolvedValue(true as any);
    await service.ensureCollection('knowledge');
    expect(mockClient.createCollection).toHaveBeenCalledWith('knowledge', expect.any(Object));
  });

  it('ensureCollection skips creation when collection exists', async () => {
    mockClient.getCollection.mockResolvedValue({} as any);
    await service.ensureCollection('knowledge');
    expect(mockClient.createCollection).not.toHaveBeenCalled();
  });

  it('upsertChunks calls upsert with correct point structure', async () => {
    mockClient.upsert.mockResolvedValue({} as any);
    await service.upsertChunks('knowledge', 'doc1', ['chunk1', 'chunk2'], [[0.1], [0.2]]);
    expect(mockClient.upsert).toHaveBeenCalledWith(
      'knowledge',
      expect.objectContaining({
        points: expect.arrayContaining([
          expect.objectContaining({ payload: expect.objectContaining({ documentId: 'doc1' }) }),
        ]),
      }),
    );
  });

  it('search applies documentId filter when provided', async () => {
    mockClient.search.mockResolvedValue([
      { payload: { documentId: 'doc1', text: 'hello' }, score: 0.9 } as any,
    ]);
    const results = await service.search('knowledge', [0.1], 4, ['doc1']);
    expect(mockClient.search).toHaveBeenCalledWith(
      'knowledge',
      expect.objectContaining({ filter: expect.any(Object) }),
    );
    expect(results[0].documentId).toBe('doc1');
    expect(results[0].score).toBe(0.9);
  });

  it('search passes no filter when no documentIds', async () => {
    mockClient.search.mockResolvedValue([]);
    await service.search('knowledge', [0.1], 4);
    expect(mockClient.search).toHaveBeenCalledWith(
      'knowledge',
      expect.objectContaining({ filter: undefined }),
    );
  });

  it('deleteDocument calls delete with correct filter', async () => {
    mockClient.delete.mockResolvedValue({} as any);
    await service.deleteDocument('knowledge', 'doc1');
    expect(mockClient.delete).toHaveBeenCalledWith(
      'knowledge',
      expect.objectContaining({ filter: expect.objectContaining({ must: expect.any(Array) }) }),
    );
  });
});

describe('VectorStoreService — scope filter, defaults and orphan scan', () => {
  function make(client: Record<string, jest.Mock>, cfg: Record<string, unknown> = {}) {
    const service = new VectorStoreService({ get: jest.fn((k: string) => cfg[k]) } as unknown as ConfigService);
    (service as any).client = client;
    return service;
  }

  it('restricts the search to exactly the given document ids and maps missing payload fields', async () => {
    const search = jest.fn().mockResolvedValue([{ score: 0.4, payload: null }]);
    const out = await make({ search }).search('knowledge', [0.1], 7, ['d1', 'd2']);
    expect(search).toHaveBeenCalledWith('knowledge', {
      vector: [0.1],
      limit: 7,
      filter: { must: [{ key: 'documentId', match: { any: ['d1', 'd2'] } }] },
      with_payload: true,
    });
    expect(out).toEqual([{ text: '', documentId: '', score: 0.4 }]);
  });

  it('an empty id list still filters (matches nothing) instead of searching every document', async () => {
    const search = jest.fn().mockResolvedValue([]);
    await make({ search }).search('knowledge', [0.1], 4, []);
    expect(search.mock.calls[0][1].filter).toEqual({ must: [{ key: 'documentId', match: { any: [] } }] });
  });

  it('deleteDocument deletes only that document’s chunks', async () => {
    const del = jest.fn().mockResolvedValue({});
    await make({ delete: del }).deleteDocument('knowledge', 'doc1');
    expect(del).toHaveBeenCalledWith('knowledge', {
      filter: { must: [{ key: 'documentId', match: { value: 'doc1' } }] },
    });
  });

  it('creates a collection with the configured default dimension', async () => {
    const createCollection = jest.fn().mockResolvedValue(true);
    const svc = make(
      { getCollection: jest.fn().mockRejectedValue(new Error('404')), createCollection },
      { 'config.kb.embeddingDimensions': 512 },
    );
    await svc.ensureCollection('knowledge');
    expect(createCollection).toHaveBeenCalledWith('knowledge', { vectors: { size: 512, distance: 'Cosine' } });
  });

  it('listDocumentIds pages through the collection and dedupes ids', async () => {
    const scroll = jest
      .fn()
      .mockResolvedValueOnce({
        points: [{ payload: { documentId: 'a' } }, { payload: { documentId: 'b' } }, { payload: {} }],
        next_page_offset: 'p2',
      })
      .mockResolvedValueOnce({ points: [{ payload: { documentId: 'a' } }, { payload: null }], next_page_offset: null });
    await expect(make({ scroll }).listDocumentIds('knowledge')).resolves.toEqual(['a', 'b']);
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroll.mock.calls[1][1]).toMatchObject({ offset: 'p2', with_vector: false, limit: 256 });
    expect(scroll.mock.calls[0][1].offset).toBeUndefined();
  });

  it('listDocumentIds returns [] for a missing collection', async () => {
    const scroll = jest.fn().mockRejectedValue(new Error('Not found'));
    await expect(make({ scroll }).listDocumentIds('knowledge')).resolves.toEqual([]);
  });

  it('listDocumentIds tolerates a page without points', async () => {
    const scroll = jest.fn().mockResolvedValue({});
    await expect(make({ scroll }).listDocumentIds('knowledge')).resolves.toEqual([]);
  });
});
