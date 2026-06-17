import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from '../kb/embedding.service';
import { VectorStoreService } from '../kb/vector-store.service';
import { KbProcessorService } from '../kb/kb-processor.service';
import { ToolContext, ToolDefinition } from './tool.interface';

@Injectable()
export class SearchKnowledgeBaseTool {
  static readonly definition: ToolDefinition = {
    name: 'search_knowledge_base',
    description:
      'Search documents the user uploaded to THIS conversation for relevant information. ' +
      'Only returns content from the current conversation; returns a clear "no relevant context" ' +
      'signal when nothing is confidently relevant.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        topK: { type: 'number', description: 'Max results to return (default 4)' },
      },
      required: ['query'],
    },
  };

  private readonly collection: string;
  private readonly defaultTopK: number;
  private readonly overFetch: number;
  private readonly scoreThreshold: number;

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStore: VectorStoreService,
    private readonly kbProcessor: KbProcessorService,
    private readonly configService: ConfigService,
  ) {
    this.collection =
      this.configService.get<string>('config.kb.qdrantCollection') ?? 'knowledge';
    this.defaultTopK = this.configService.get<number>('config.kb.topK') ?? 4;
    this.overFetch = this.configService.get<number>('config.kb.overFetch') ?? 8;
    this.scoreThreshold = this.configService.get<number>('config.kb.scoreThreshold') ?? 0.5;
  }

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const query = input['query'] as string;
    const topK = (input['topK'] as number | undefined) ?? this.defaultTopK;

    // Privacy: scope strictly to the current conversation's processed docs.
    const docIds = await this.kbProcessor.getReadyDocumentIds(ctx.conversationId);
    if (docIds.length === 0) {
      return 'No relevant context: this conversation has no processed knowledge-base documents.';
    }

    const vector = await this.embeddingService.embedOne(query);
    // Over-fetch then rerank by score and keep the best `topK`.
    const raw = await this.vectorStore.search(
      this.collection,
      vector,
      Math.max(this.overFetch, topK),
      docIds,
    );

    const relevant = raw
      .filter((r) => r.score >= this.scoreThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (relevant.length === 0) {
      return 'No relevant context: no document chunk cleared the confidence threshold for this query.';
    }

    return relevant
      .map((r, i) => `[Source ${i + 1}] (score ${r.score.toFixed(2)}) ${r.text}`)
      .join('\n\n');
  }
}
