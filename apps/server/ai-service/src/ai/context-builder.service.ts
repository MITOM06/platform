import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryService } from '../memory/memory.service';
import { KbProcessorService } from '../kb/kb-processor.service';
import { EmbeddingService } from '../kb/embedding.service';
import { VectorStoreService } from '../kb/vector-store.service';

interface RagSource {
  documentId: string;
  score: number;
}

export interface VolatileContext {
  text: string;
  ragSources: RagSource[];
}

/**
 * Assembles the volatile per-request grounding block (RAG context + retrieved
 * memory facts). Returned separately from the stable persona so it is appended
 * AFTER the cached prefix and never busts the prompt cache.
 */
@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);
  private readonly qdrantCollection: string;
  private readonly topK: number;
  private readonly overFetch: number;
  private readonly scoreThreshold: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly memoryService: MemoryService,
    private readonly kbProcessor: KbProcessorService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStore: VectorStoreService,
  ) {
    this.qdrantCollection =
      this.configService.get<string>('config.kb.qdrantCollection') ?? 'knowledge';
    this.topK = this.configService.get<number>('config.kb.topK') ?? 4;
    this.overFetch = this.configService.get<number>('config.kb.overFetch') ?? 8;
    this.scoreThreshold = this.configService.get<number>('config.kb.scoreThreshold') ?? 0.5;
  }

  async buildVolatileContext(
    conversationId: string,
    userId: string,
    queryVector: number[] | null,
    departmentId?: string,
  ): Promise<VolatileContext> {
    const parts: string[] = [];
    const ragSources: RagSource[] = [];

    // --- Retrieved memory facts (most relevant only) ---
    if (queryVector) {
      try {
        const facts = await this.memoryService.retrieveRelevantFacts(
          userId,
          conversationId,
          queryVector,
        );
        if (facts.length > 0) {
          parts.push(
            `## Relevant memory about this user (stored facts — treat as remembered, not inferred):\n` +
              facts.map((f) => `- ${f.text}`).join('\n'),
          );
        }
      } catch (err) {
        this.logger.warn(`Memory retrieval failed for ${conversationId}`, err);
      }
    }

    // --- RAG / knowledge-base context with confidence gating ---
    try {
      const docIds = await this.kbProcessor.getReadyDocumentIds(
        conversationId,
        departmentId,
      );
      if (docIds.length === 0) {
        parts.push(
          `## Knowledge Base Context:\nNo documents have been uploaded to this conversation. Do not cite sources.`,
        );
      } else if (queryVector) {
        const raw = await this.vectorStore.search(
          this.qdrantCollection,
          queryVector,
          Math.max(this.overFetch, this.topK),
          docIds,
        );
        // Confidence gate + rerank: keep best `topK` above threshold.
        const relevant = raw
          .filter((r) => r.score >= this.scoreThreshold)
          .sort((a, b) => b.score - a.score)
          .slice(0, this.topK);

        if (relevant.length > 0) {
          relevant.forEach((r) => ragSources.push({ documentId: r.documentId, score: r.score }));
          parts.push(
            `## Knowledge Base Context:\n` +
              relevant.map((r, i) => `[Source ${i + 1}] ${r.text}`).join('\n\n') +
              `\n\nUse ONLY this context for document-grounded claims and cite as [Source N]. ` +
              `If it does not answer the question, say you don't have that information.`,
          );
        } else {
          parts.push(
            `## Knowledge Base Context:\nNo relevant context: no uploaded-document chunk cleared the confidence threshold for this question. ` +
              `Do not fabricate document content; say you couldn't find it in the uploaded files.`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `RAG context fetch failed for ${conversationId}, proceeding without context`,
        err,
      );
    }

    return { text: parts.join('\n\n'), ragSources };
  }
}
