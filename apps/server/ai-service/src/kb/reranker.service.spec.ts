import { ConfigService } from '@nestjs/config';
import { RerankerService } from './reranker.service';
import { VectorSearchResult } from './vector-store.service';

function makeConfig(over: Record<string, unknown> = {}): ConfigService {
  const map: Record<string, unknown> = {
    'config.kb.hybridEnabled': true,
    'config.cohere.apiKey': undefined,
    'config.cohere.rerankModel': 'rerank-v3.5',
    'config.cohere.rerankThreshold': 0.3,
    ...over,
  };
  return { get: jest.fn((k: string) => map[k]) } as unknown as ConfigService;
}

const cand = (documentId: string, score: number, text: string): VectorSearchResult => ({
  documentId,
  score,
  text,
});

describe('RerankerService.fuseHybrid', () => {
  const svc = new RerankerService(makeConfig());

  it('promotes a keyword match above a higher-vector candidate with no keywords', () => {
    const candidates = [
      cand('A', 0.95, 'cooking pasta recipe with tomato'),
      cand('B', 0.9, 'weather forecast today sunny'),
      cand('C', 0.85, 'flutter riverpod guide'),
    ];
    const out = svc.fuseHybrid('flutter riverpod', candidates);
    const ids = out.map((c) => c.documentId);
    // C (keyword hit, worst vector score) must rise above the keyword-less B.
    expect(ids.indexOf('C')).toBeLessThan(ids.indexOf('B'));
  });

  it('returns candidates unchanged when the query has no usable terms', () => {
    const candidates = [cand('A', 0.9, 'alpha'), cand('B', 0.8, 'beta')];
    expect(svc.fuseHybrid('  ', candidates)).toEqual(candidates);
  });
});

describe('RerankerService.refine', () => {
  it('passes through a single candidate without reranking', async () => {
    const svc = new RerankerService(makeConfig());
    const only = [cand('A', 0.9, 'x')];
    expect(await svc.refine('q', only, 4)).toEqual(only);
  });

  it('reports cohere disabled when no key is configured', () => {
    expect(new RerankerService(makeConfig()).cohereEnabled).toBe(false);
  });

  it('uses Cohere ordering and drops below-threshold hits when a key is set', async () => {
    const svc = new RerankerService(makeConfig({ 'config.cohere.apiKey': 'test-key' }));
    const candidates = [
      cand('A', 0.9, 'first'),
      cand('B', 0.8, 'second'),
      cand('C', 0.7, 'third'),
    ];
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { index: 2, relevance_score: 0.92 }, // C
          { index: 0, relevance_score: 0.81 }, // A
          { index: 1, relevance_score: 0.10 }, // B — below 0.3 threshold, dropped
        ],
      }),
    });
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;

    const out = await svc.refine('q', candidates, 4);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.map((c) => c.documentId)).toEqual(['C', 'A']);
  });

  it('falls back to hybrid order when the Cohere call errors', async () => {
    const svc = new RerankerService(makeConfig({ 'config.cohere.apiKey': 'test-key' }));
    const candidates = [cand('A', 0.9, 'flutter'), cand('B', 0.8, 'riverpod')];
    (global as unknown as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down'));

    const out = await svc.refine('flutter riverpod', candidates, 4);

    // Did not throw; returned the (hybrid) candidate set.
    expect(out).toHaveLength(2);
  });
});
