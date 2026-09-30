import { ConfigService } from '@nestjs/config';
import { KbProcessorService } from './kb-processor.service';
import { VectorStoreService } from './vector-store.service';

/**
 * purgeOrphanedChunks reports how many orphaned documents it removed, and that
 * number is logged by the retention sweep. Every delete failure is caught and
 * logged, so counting attempts instead of successes produces a sweep that
 * claims to have purged N documents in the very run where all N failed.
 *
 * Only the vector store and the Mongo model matter here; the extraction,
 * embedding and publishing deps are never touched on this path.
 */
function makeService(opts: {
  chunkDocIds: string[];
  knownDocIds: string[];
  deleteDocument: jest.Mock;
}): KbProcessorService {
  const config = {
    get: jest.fn((k: string) => (k === 'config.kb.qdrantCollection' ? 'knowledge' : undefined)),
  } as unknown as ConfigService;

  const vectorStore = {
    listDocumentIds: jest.fn().mockResolvedValue(opts.chunkDocIds),
    deleteDocument: opts.deleteDocument,
  } as unknown as VectorStoreService;

  const kbDocumentModel = {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(opts.knownDocIds.map((documentId) => ({ documentId }))),
        }),
      }),
    }),
  };

  return new KbProcessorService(
    kbDocumentModel as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    vectorStore,
    {} as never,
    config,
  );
}

describe('KbProcessorService.purgeOrphanedChunks', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('counts documents it actually deleted', async () => {
    const deleteDocument = jest.fn().mockResolvedValue(undefined);
    const svc = makeService({
      chunkDocIds: ['keep', 'orphan-a', 'orphan-b'],
      knownDocIds: ['keep'],
      deleteDocument,
    });

    await expect(svc.purgeOrphanedChunks()).resolves.toBe(2);
    expect(deleteDocument).toHaveBeenCalledTimes(2);
  });

  it('does not count a deletion that failed', async () => {
    const deleteDocument = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('qdrant down'));
    const svc = makeService({
      chunkDocIds: ['orphan-a', 'orphan-b'],
      knownDocIds: [],
      deleteDocument,
    });

    // Two orphans, one delete failed — the sweep must be told about one.
    await expect(svc.purgeOrphanedChunks()).resolves.toBe(1);
  });

  it('reports zero, not the attempt count, when every deletion fails', async () => {
    const deleteDocument = jest.fn().mockRejectedValue(new Error('qdrant down'));
    const svc = makeService({
      chunkDocIds: ['orphan-a', 'orphan-b', 'orphan-c'],
      knownDocIds: [],
      deleteDocument,
    });

    await expect(svc.purgeOrphanedChunks()).resolves.toBe(0);
  });

  it('still never throws when the vector store is failing', async () => {
    const svc = makeService({
      chunkDocIds: ['orphan-a'],
      knownDocIds: [],
      deleteDocument: jest.fn().mockRejectedValue(new Error('qdrant down')),
    });

    await expect(svc.purgeOrphanedChunks()).resolves.toBeDefined();
  });
});
