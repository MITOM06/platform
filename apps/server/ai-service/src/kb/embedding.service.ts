import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const BATCH_SIZE = 100;

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

/**
 * Text → vector embeddings via Voyage AI (Anthropic's recommended embeddings
 * partner). Used ONLY for RAG, memory, and the semantic response cache — the
 * chat LLM is Anthropic Claude and never touches this. Disabled (throws) when
 * VOYAGE_API_KEY is unset; callers handle that fail-soft (RAG/memory just off).
 */
@Injectable()
export class EmbeddingService {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('config.voyage.apiKey') || undefined;
    if (!this.apiKey) {
      this.logger.warn('VOYAGE_API_KEY not set — EmbeddingService disabled (RAG/memory off)');
    }
    this.model = this.configService.get<string>('config.kb.embeddingModel') ?? 'voyage-3.5';
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('EmbeddingService: VOYAGE_API_KEY not configured');
    }
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const res = await fetch(VOYAGE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: batch, model: this.model }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Voyage embeddings ${res.status}: ${text.slice(0, 200)}`);
      }
      const body = (await res.json()) as VoyageResponse;
      const sorted = [...body.data].sort((a, b) => a.index - b.index);
      results.push(...sorted.map((d) => d.embedding));
    }
    return results;
  }

  async embedOne(text: string): Promise<number[]> {
    const vecs = await this.embed([text]);
    return vecs[0];
  }
}
