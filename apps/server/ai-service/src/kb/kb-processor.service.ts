import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { DocumentExtractorService } from './document-extractor.service';
import { VisionDescribeService } from './vision-describe.service';
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
  private readonly visionEnabled: boolean;
  private readonly visionPdfEnabled: boolean;
  private readonly visionMinTextChars: number;

  constructor(
    @InjectModel(KbDocument.name) private readonly kbDocumentModel: Model<KbDocumentDocument>,
    private readonly documentExtractor: DocumentExtractorService,
    private readonly visionDescribe: VisionDescribeService,
    private readonly textChunker: TextChunkerService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStore: VectorStoreService,
    private readonly publisher: RedisPublisherService,
    private readonly configService: ConfigService,
  ) {
    this.collection =
      this.configService.get<string>('config.kb.qdrantCollection') ?? 'knowledge';
    this.visionEnabled = this.configService.get<boolean>('config.kb.visionEnabled') ?? true;
    this.visionPdfEnabled = this.configService.get<boolean>('config.kb.visionPdfEnabled') ?? true;
    this.visionMinTextChars =
      this.configService.get<number>('config.kb.visionMinTextChars') ?? 64;
  }

  async processDocument(payload: KbProcessPayload): Promise<void> {
    const { documentId, conversationId, userId, fileUrl, mimeType, fileName, departmentId } =
      payload;

    try {
      // Mark the shared kb_documents record (created by chat-service on upload) as "processing".
      // Use $setOnInsert for identity/uploadedAt so we never clobber chat-service's original values
      // on the normal path; $set only the fields ai-service actually owns during processing.
      // departmentId is propagated so dept-scoped RAG works even if ai-service upserts first.
      await this.kbDocumentModel.findOneAndUpdate(
        { documentId },
        {
          $set: {
            conversationId,
            userId,
            fileName,
            mimeType,
            status: 'processing',
            ...(departmentId ? { departmentId } : {}),
          },
          $setOnInsert: { documentId, uploadedAt: new Date() },
        },
        { upsert: true, new: true },
      );

      // Fetch file content
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${fileUrl}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract text (image uploads & sparse/scanned PDFs route through vision).
      const text = await this.resolveText(buffer, mimeType);

      // Chunk
      const chunkSize = this.configService.get<number>('config.kb.chunkSize') ?? 512;
      const chunkOverlap = this.configService.get<number>('config.kb.chunkOverlap') ?? 80;
      const chunks = this.textChunker.chunk(text, chunkSize, chunkOverlap);

      if (chunks.length === 0) throw new Error('No text extracted from document');

      // Embed
      const vectors = await this.embeddingService.embed(chunks);

      // Ensure Qdrant collection exists, sized to the actual embedding dimension.
      await this.vectorStore.ensureCollection(this.collection, vectors[0]?.length);

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

  /**
   * Resolve the indexable text for a document (TASK-10 vision). Routing:
   *  - image/* (vision-supported): describe via Claude vision → use as text.
   *  - PDF whose pdf-parse text is sparse (< KB_VISION_MIN_TEXT_CHARS): describe
   *    the whole PDF via the native document block; fall back to sparse text.
   *  - everything else: extract as before.
   * Vision is fully gated (KB_VISION_ENABLED / KB_VISION_PDF_ENABLED + API key)
   * and degrades gracefully — a vision failure NEVER crashes the pipeline; it
   * falls back to today's behavior (image → throw so the doc errors; sparse PDF
   * → index the sparse text it has).
   */
  private async resolveText(buffer: Buffer, mimeType: string): Promise<string> {
    const visionUsable = this.visionEnabled && this.visionDescribe.isAvailable();

    // (a) Direct image upload.
    if (this.documentExtractor.isImage(mimeType)) {
      if (visionUsable && this.documentExtractor.isVisionSupportedImage(mimeType)) {
        try {
          const description = await this.visionDescribe.describeImage(buffer, mimeType);
          if (description.trim()) return description;
          this.logger.warn(`Vision returned empty description for image (${mimeType})`);
        } catch (err) {
          this.logger.warn(
            `Image vision failed (${mimeType}), degrading: ${(err as Error).message}`,
          );
        }
      }
      // Vision off / unsupported image (heic/bmp/svg) / vision failed →
      // preserve prior behavior: extractText throws → doc marked error.
      return this.documentExtractor.extractText(buffer, mimeType);
    }

    // Non-image: extract as before.
    const text = await this.documentExtractor.extractText(buffer, mimeType);

    // (b) Scanned/image-heavy PDF whose extracted text is sparse → whole-doc vision.
    const isPdf = mimeType.toLowerCase().split(';')[0].trim() === 'application/pdf';
    if (
      isPdf &&
      visionUsable &&
      this.visionPdfEnabled &&
      text.trim().length < this.visionMinTextChars
    ) {
      try {
        const description = await this.visionDescribe.describePdf(buffer);
        if (description.trim()) return description;
        this.logger.warn('PDF vision returned empty description, falling back to sparse text');
      } catch (err) {
        this.logger.warn(`PDF vision failed, falling back to sparse text: ${(err as Error).message}`);
      }
    }

    return text;
  }

  /**
   * Processed document ids visible to a request. In a department group chat
   * ([departmentId] set) the bot sees the whole department's KB (shared across
   * its conversations); otherwise scoped to the single conversation (P6).
   */
  async getReadyDocumentIds(
    conversationId: string,
    departmentId?: string,
  ): Promise<string[]> {
    const filter = departmentId
      ? { departmentId, status: 'done' }
      : { conversationId, status: 'done' };
    const docs = await this.kbDocumentModel
      .find(filter)
      .select('documentId')
      .lean()
      .exec();
    return docs.map((d) => d.documentId);
  }

  /**
   * Resolve display filenames for a set of document ids from the shared
   * kb_documents collection. Used to enrich RAG citation sources so clients can
   * render clickable references. Lookups are deduplicated; ids without a record
   * (or with an empty fileName) are simply absent from the returned map. Fully
   * fail-soft — on any error an empty map is returned so the answer still streams.
   */
  async getFileNames(documentIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const uniqueIds = [...new Set(documentIds.filter((id) => !!id))];
    if (uniqueIds.length === 0) return result;

    try {
      const docs = await this.kbDocumentModel
        .find({ documentId: { $in: uniqueIds } })
        .select('documentId fileName')
        .lean()
        .exec();
      for (const d of docs) {
        if (d.fileName) result.set(d.documentId, d.fileName);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to resolve KB filenames for ${uniqueIds.length} document(s): ${(err as Error).message}`,
      );
    }
    return result;
  }

  /**
   * Retention: delete vector chunks whose owning kb_documents record no longer
   * exists (uploads that were removed but whose `kb:delete` cleanup failed, or
   * legacy leftovers). Returns the number of orphaned documents purged.
   */
  async purgeOrphanedChunks(): Promise<number> {
    const chunkDocIds = await this.vectorStore.listDocumentIds(this.collection);
    if (chunkDocIds.length === 0) return 0;

    const known = await this.kbDocumentModel
      .find({ documentId: { $in: chunkDocIds } })
      .select('documentId')
      .lean()
      .exec();
    const knownSet = new Set(known.map((d) => d.documentId));

    const orphans = chunkDocIds.filter((id) => !knownSet.has(id));
    for (const documentId of orphans) {
      await this.vectorStore.deleteDocument(this.collection, documentId).catch((err) => {
        this.logger.warn(`Failed to purge orphan chunks for ${documentId}: ${(err as Error).message}`);
      });
    }
    if (orphans.length > 0) {
      this.logger.log(`Purged ${orphans.length} orphaned KB document(s) from vector store`);
    }
    return orphans.length;
  }
}
