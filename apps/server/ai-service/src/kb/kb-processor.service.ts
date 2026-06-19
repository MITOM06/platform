import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { DocumentExtractorService } from './document-extractor.service';
import { TextChunkerService } from './text-chunker.service';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vector-store.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { KbDocument, KbDocumentDocument } from './kb-document.schema';
import { KbProcessPayload } from './kb-process-payload.interface';

@Injectable()
export class KbProcessorService {
  private readonly logger = new Logger(KbProcessorService.name);
  private readonly collection: string;

  constructor(
    @InjectModel(KbDocument.name) private readonly kbDocumentModel: Model<KbDocumentDocument>,
    private readonly documentExtractor: DocumentExtractorService,
    private readonly textChunker: TextChunkerService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStore: VectorStoreService,
    private readonly publisher: RedisPublisherService,
    private readonly configService: ConfigService,
  ) {
    this.collection =
      this.configService.get<string>('config.kb.qdrantCollection') ?? 'knowledge';
  }

  async processDocument(payload: KbProcessPayload): Promise<void> {
    const { documentId, conversationId, userId, fileUrl, mimeType, fileName } = payload;

    try {
      // Mark the shared kb_documents record (created by chat-service on upload) as "processing".
      // Use $setOnInsert for identity/uploadedAt so we never clobber chat-service's original values
      // on the normal path; $set only the fields ai-service actually owns during processing.
      await this.kbDocumentModel.findOneAndUpdate(
        { documentId },
        {
          $set: { conversationId, userId, fileName, mimeType, status: 'processing' },
          $setOnInsert: { documentId, uploadedAt: new Date() },
        },
        { upsert: true, new: true },
      );

      // Fetch file content
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${fileUrl}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract text
      const text = await this.documentExtractor.extractText(buffer, mimeType);

      // Chunk
      const chunkSize = this.configService.get<number>('config.kb.chunkSize') ?? 512;
      const chunkOverlap = this.configService.get<number>('config.kb.chunkOverlap') ?? 80;
      const chunks = this.textChunker.chunk(text, chunkSize, chunkOverlap);

      if (chunks.length === 0) throw new Error('No text extracted from document');

      // Embed
      const vectors = await this.embeddingService.embed(chunks);

      // Ensure Qdrant collection exists
      await this.vectorStore.ensureCollection(this.collection);

      // Upsert vectors
      await this.vectorStore.upsertChunks(this.collection, documentId, chunks, vectors);

      // Update status to done
      await this.kbDocumentModel.findOneAndUpdate(
        { documentId },
        { $set: { status: 'done', chunkCount: chunks.length } },
      );

      // Notify chat-service
      await this.publisher.publishToChannel(`kb:status:${documentId}`, {
        type: 'KB_DONE',
        documentId,
        conversationId,
        chunkCount: chunks.length,
      });

      this.logger.log(`Processed document ${documentId} (${chunks.length} chunks)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to process document ${documentId}`, err);

      await this.kbDocumentModel
        .findOneAndUpdate({ documentId }, { $set: { status: 'error' } })
        .catch(() => {});

      await this.publisher
        .publishToChannel(`kb:status:${documentId}`, {
          type: 'KB_ERROR',
          documentId,
          conversationId,
          error: message,
        })
        .catch(() => {});
    }
  }

  async getReadyDocumentIds(conversationId: string): Promise<string[]> {
    const docs = await this.kbDocumentModel
      .find({ conversationId, status: 'done' })
      .select('documentId')
      .lean()
      .exec();
    return docs.map((d) => d.documentId);
  }
}
