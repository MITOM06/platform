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
