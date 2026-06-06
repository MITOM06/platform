import { Injectable } from '@nestjs/common';
import { EmbeddingService } from '../kb/embedding.service';
import { VectorStoreService } from '../kb/vector-store.service';
import { ToolContext, ToolDefinition } from './tool.interface';

@Injectable()
export class SearchKnowledgeBaseTool {
  static readonly definition: ToolDefinition = {
    name: 'search_knowledge_base',
    description: 'Search uploaded documents in the knowledge base for relevant information.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        topK: { type: 'number', description: 'Max results to return (default 3)' },
      },
      required: ['query'],
    },
  };

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
    const query = input['query'] as string;
    const topK = (input['topK'] as number | undefined) ?? 3;

    const vector = await this.embeddingService.embedOne(query);
    const results = await this.vectorStore.search('knowledge', vector, topK);

    if (results.length === 0) return 'No relevant documents found';

    return results
      .map((r, i) => `Result ${i + 1}: ${r.text}`)
      .join('\n\n');
  }
}
