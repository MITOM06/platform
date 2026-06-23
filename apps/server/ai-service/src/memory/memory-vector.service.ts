import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';

export interface MemoryFactPoint {
  id: string;
  text: string;
  score: number;
  createdAt: number; // epoch ms
  source: string;
}

interface UpsertFactInput {
  text: string;
  vector: number[];
  source: string;
  createdAt?: number;
  id?: string;
}

/**
 * Embedding-backed semantic fact store on a dedicated Qdrant collection.
 * Points are keyed by {userId, conversationId} (stored in payload + used as filter).
 * Migrates gracefully: all reads tolerate a missing/empty collection.
 */
@Injectable()
export class MemoryVectorService {
  private readonly logger = new Logger(MemoryVectorService.name);
  private readonly client: QdrantClient;
  private readonly collection: string;
  private readonly defaultDim: number;
  private ensured = false;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('config.qdrant.url') ?? 'http://localhost:6333';
    this.client = new QdrantClient({ url });
    this.collection =
      this.configService.get<string>('config.memory.qdrantCollection') ?? 'ai_memory';
    this.defaultDim = this.configService.get<number>('config.kb.embeddingDimensions') ?? 1024;
  }

  private async ensureCollection(vectorSize?: number): Promise<void> {
    if (this.ensured) return;
    try {
      await this.client.getCollection(this.collection);
    } catch {
      try {
        await this.client.createCollection(this.collection, {
          vectors: { size: vectorSize ?? this.defaultDim, distance: 'Cosine' },
        });
      } catch (err) {
        this.logger.warn(`Could not ensure memory collection: ${(err as Error).message}`);
        return;
      }
    }
    this.ensured = true;
  }

  private scopeFilter(userId: string, conversationId: string) {
    return {
      must: [
        { key: 'userId', match: { value: userId } },
        { key: 'conversationId', match: { value: conversationId } },
      ],
    };
  }

  /** Retrieve the most relevant facts for a query, scoped to {userId, conversationId}. */
  async retrieve(
    userId: string,
    conversationId: string,
    queryVector: number[],
    topN: number,
  ): Promise<MemoryFactPoint[]> {
    try {
      await this.ensureCollection(queryVector.length);
      const results = await this.client.search(this.collection, {
        vector: queryVector,
        limit: topN,
        filter: this.scopeFilter(userId, conversationId),
        with_payload: true,
      });
      return results.map((r) => ({
        id: String(r.id),
        text: (r.payload?.['text'] as string) ?? '',
        score: r.score,
        createdAt: (r.payload?.['createdAt'] as number) ?? 0,
        source: (r.payload?.['source'] as string) ?? 'unknown',
      }));
    } catch (err) {
      this.logger.warn(`Memory retrieve failed (returning none): ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Find the nearest existing fact to a candidate vector (for dedup).
   * Returns null if the collection is empty or on error.
   */
  async nearest(
    userId: string,
    conversationId: string,
    vector: number[],
  ): Promise<MemoryFactPoint | null> {
    try {
      await this.ensureCollection(vector.length);
      const results = await this.client.search(this.collection, {
        vector,
        limit: 1,
        filter: this.scopeFilter(userId, conversationId),
        with_payload: true,
      });
      if (results.length === 0) return null;
      const r = results[0];
      return {
        id: String(r.id),
        text: (r.payload?.['text'] as string) ?? '',
        score: r.score,
        createdAt: (r.payload?.['createdAt'] as number) ?? 0,
        source: (r.payload?.['source'] as string) ?? 'unknown',
      };
    } catch (err) {
      this.logger.warn(`Memory nearest lookup failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Upsert a fact point (insert new, or overwrite an existing id when deduping). */
  async upsertFact(
    userId: string,
    conversationId: string,
    fact: UpsertFactInput,
  ): Promise<void> {
    try {
      await this.ensureCollection(fact.vector.length);
      await this.client.upsert(this.collection, {
        wait: true,
        points: [
          {
            id: fact.id ?? randomUUID(),
            vector: fact.vector,
            payload: {
              userId,
              conversationId,
              text: fact.text,
              source: fact.source,
              createdAt: fact.createdAt ?? Date.now(),
            },
          },
        ],
      });
    } catch (err) {
      this.logger.warn(`Memory upsert failed for ${conversationId}: ${(err as Error).message}`);
    }
  }

  /** List all facts for a conversation (used to rebuild the canonical Mongo list). */
  async listFacts(userId: string, conversationId: string): Promise<MemoryFactPoint[]> {
    try {
      await this.ensureCollection();
      const res = await this.client.scroll(this.collection, {
        filter: this.scopeFilter(userId, conversationId),
        with_payload: true,
        limit: 256,
      });
      return (res.points ?? []).map((p) => ({
        id: String(p.id),
        text: (p.payload?.['text'] as string) ?? '',
        score: 0,
        createdAt: (p.payload?.['createdAt'] as number) ?? 0,
        source: (p.payload?.['source'] as string) ?? 'unknown',
      }));
    } catch (err) {
      this.logger.warn(`Memory list failed: ${(err as Error).message}`);
      return [];
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await this.ensureCollection();
      await this.client.delete(this.collection, {
        wait: true,
        filter: { must: [{ key: 'conversationId', match: { value: conversationId } }] },
      });
    } catch (err) {
      this.logger.warn(`Memory delete failed for ${conversationId}: ${(err as Error).message}`);
    }
  }

  /**
   * Retention purge: delete all fact points created before `cutoffMs`.
   * No-op-safe when the collection is empty/missing.
   */
  async deleteOlderThan(cutoffMs: number): Promise<void> {
    try {
      await this.ensureCollection();
      await this.client.delete(this.collection, {
        wait: true,
        filter: { must: [{ key: 'createdAt', range: { lt: cutoffMs } }] },
      });
    } catch (err) {
      this.logger.warn(`Memory TTL purge failed: ${(err as Error).message}`);
    }
  }
}
