import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VectorSearchResult } from './vector-store.service';

/**
 * Two-stage retrieval refinement over an enlarged vector candidate pool:
 *
 *  1. Hybrid fusion (always on): in-process BM25 keyword scoring is fused with
 *     the vector ranking via Reciprocal Rank Fusion (RRF). This rescues exact
 *     keyword / ID / proper-noun matches that pure cosine similarity buries.
 *  2. Cohere rerank (optional): when COHERE_API_KEY is set, the fused shortlist
 *     is reordered by a neural cross-encoder for best top-K precision. Without
 *     the key — or on any API error — it degrades to the hybrid order, so the
 *     reranker is never a hard dependency.
 *
 * Note: keyword recall is bounded by the vector candidate pool (we re-rank what
 * vector retrieved, we don't run a separate full-corpus keyword index). Enlarge
 * `KB_CANDIDATE_POOL` to widen it.
 */
@Injectable()
export class RerankerService {
  private readonly logger = new Logger(RerankerService.name);
  private readonly hybridEnabled: boolean;
  private readonly cohereApiKey?: string;
  private readonly cohereModel: string;
  private readonly cohereThreshold: number;

  // BM25 hyper-parameters (standard defaults).
  private static readonly K1 = 1.5;
  private static readonly B = 0.75;
  // RRF damping constant (Cormack et al.).
  private static readonly RRF_K = 60;

  constructor(private readonly configService: ConfigService) {
    this.hybridEnabled = this.configService.get<boolean>('config.kb.hybridEnabled') ?? true;
    this.cohereApiKey = this.configService.get<string>('config.cohere.apiKey') || undefined;
    this.cohereModel =
      this.configService.get<string>('config.cohere.rerankModel') ?? 'rerank-v3.5';
    this.cohereThreshold =
      this.configService.get<number>('config.cohere.rerankThreshold') ?? 0.3;
  }

  /** True when a Cohere key is configured (neural rerank available). */
  get cohereEnabled(): boolean {
    return !!this.cohereApiKey;
  }

  /**
   * Refine candidates for a query and return the best `topK`. Pure function of
   * its inputs aside from the optional Cohere network call.
   */
  async refine(
    query: string,
    candidates: VectorSearchResult[],
    topK: number,
  ): Promise<VectorSearchResult[]> {
    if (candidates.length <= 1) return candidates.slice(0, topK);

    const fused = this.hybridEnabled ? this.fuseHybrid(query, candidates) : candidates;

    if (this.cohereEnabled) {
      const reranked = await this.cohereRerank(query, fused);
      if (reranked) return reranked.slice(0, topK);
    }
    return fused.slice(0, topK);
  }

  /** RRF over the vector ranking and an in-process BM25 keyword ranking. */
  fuseHybrid(query: string, candidates: VectorSearchResult[]): VectorSearchResult[] {
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) return candidates;

    const bm25 = this.bm25Scores(queryTerms, candidates);

    // Rank by vector score (candidates arrive already vector-sorted, but be safe).
    const vectorRank = this.rankIndices(candidates.map((c) => c.score));
    const keywordRank = this.rankIndices(bm25);

    const rrf = candidates.map((_, i) => {
      const vr = vectorRank[i];
      const kr = keywordRank[i];
      return 1 / (RerankerService.RRF_K + vr) + 1 / (RerankerService.RRF_K + kr);
    });

    return candidates
      .map((c, i) => ({ c, score: rrf[i] }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }

  /** Returns a rank (1 = best) per index, ordered by the given scores desc. */
  private rankIndices(scores: number[]): number[] {
    const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
    const rank = new Array<number>(scores.length);
    order.forEach((o, position) => {
      rank[o.i] = position + 1;
    });
    return rank;
  }

  private bm25Scores(queryTerms: string[], candidates: VectorSearchResult[]): number[] {
    const docs = candidates.map((c) => this.tokenize(c.text));
    const n = docs.length;
    const avgdl = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(1, n);

    // Document frequency per query term.
    const df = new Map<string, number>();
    for (const term of new Set(queryTerms)) {
      df.set(term, docs.filter((d) => d.includes(term)).length);
    }

    return docs.map((doc) => {
      const len = doc.length || 1;
      const tf = new Map<string, number>();
      for (const w of doc) tf.set(w, (tf.get(w) ?? 0) + 1);

      let score = 0;
      for (const term of queryTerms) {
        const f = tf.get(term);
        if (!f) continue;
        const dft = df.get(term) ?? 0;
        const idf = Math.log(1 + (n - dft + 0.5) / (dft + 0.5));
        const denom =
          f + RerankerService.K1 * (1 - RerankerService.B + (RerankerService.B * len) / avgdl);
        score += idf * ((f * (RerankerService.K1 + 1)) / denom);
      }
      return score;
    });
  }

  private tokenize(text: string): string[] {
    const matches = text.toLowerCase().match(/[a-z0-9]+/gi);
    return (matches ?? []).filter((t: string) => t.length > 1);
  }

  /**
   * Reorder candidates with Cohere Rerank. Returns null on any failure so the
   * caller falls back to hybrid ordering. Bounded by a short timeout.
   */
  private async cohereRerank(
    query: string,
    candidates: VectorSearchResult[],
  ): Promise<VectorSearchResult[] | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch('https://api.cohere.com/v2/rerank', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cohereApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.cohereModel,
          query,
          documents: candidates.map((c) => c.text),
          top_n: candidates.length,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Cohere rerank HTTP ${res.status}; falling back to hybrid order`);
        return null;
      }
      const data = (await res.json()) as {
        results?: Array<{ index: number; relevance_score: number }>;
      };
      const results = data.results;
      if (!results?.length) return null;

      return results
        .filter((r) => r.relevance_score >= this.cohereThreshold)
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .map((r) => candidates[r.index])
        .filter((c): c is VectorSearchResult => !!c);
    } catch (err) {
      this.logger.warn(`Cohere rerank failed (${(err as Error).message}); using hybrid order`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
