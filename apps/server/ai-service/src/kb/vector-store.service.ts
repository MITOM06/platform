import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';

export interface VectorSearchResult {
  text: string;
  documentId: string;
  score: number;
}

@Injectable()
export class VectorStoreService {
  private readonly client: QdrantClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('config.qdrant.url') ?? 'http://localhost:6333';
    this.client = new QdrantClient({ url });
  }

  async ensureCollection(collectionName: string, vectorSize = 1536): Promise<void> {
    try {
      await this.client.getCollection(collectionName);
    } catch {
      await this.client.createCollection(collectionName, {
        vectors: { size: vectorSize, distance: 'Cosine' },
      });
    }
  }

  async upsertChunks(
    collectionName: string,
    documentId: string,
    chunks: string[],
    vectors: number[][],
  ): Promise<void> {
    const points = chunks.map((text, chunkIndex) => ({
      id: randomUUID(),
      vector: vectors[chunkIndex],
      payload: { documentId, text, chunkIndex },
    }));

    await this.client.upsert(collectionName, { points, wait: true });
  }

  async search(
    collectionName: string,
    queryVector: number[],
    topK = 4,
    filterDocumentIds?: string[],
  ): Promise<VectorSearchResult[]> {
    const filter = filterDocumentIds
      ? {
          must: [
            {
              key: 'documentId',
              match: { any: filterDocumentIds },
            },
          ],
        }
      : undefined;

    const results = await this.client.search(collectionName, {
      vector: queryVector,
      limit: topK,
      filter,
      with_payload: true,
    });

    return results.map((r) => ({
      text: (r.payload?.['text'] as string) ?? '',
      documentId: (r.payload?.['documentId'] as string) ?? '',
      score: r.score,
    }));
  }

  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    await this.client.delete(collectionName, {
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
    });
  }
}
