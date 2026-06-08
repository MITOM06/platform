import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private readonly client: OpenAI | null = null;
  private readonly model: string;
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('config.openai.apiKey');
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY not set — EmbeddingService disabled');
    }
    this.model =
      this.configService.get<string>('config.kb.embeddingModel') ?? 'text-embedding-3-small';
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error('EmbeddingService: OpenAI API key not configured');
    }
    const BATCH_SIZE = 100;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
      });
      const sorted = response.data.sort((a, b) => a.index - b.index);
      results.push(...sorted.map((d) => d.embedding));
    }

    return results;
  }

  async embedOne(text: string): Promise<number[]> {
    const vecs = await this.embed([text]);
    return vecs[0];
  }
}
