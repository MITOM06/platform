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
import { internalUploadHeaders } from '../common/upload-ref';
import { KbProcessPayload } from './kb-process-payload.interface';

@Injectable()
export class KbProcessorService {
  private readonly logger = new Logger(KbProcessorService.name);
  private readonly collection: string;
  private readonly visionEnabled: boolean;
  private readonly visionPdfEnabled: boolean;
  private readonly visionMinTextChars: number;
  private readonly chatBaseUrl: string;
  private readonly internalApiKey?: string;

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
    this.internalApiKey = this.configService.get<string>('config.connector.internalApiKey');
    this.chatBaseUrl = (
      this.configService.get<string>('config.chat.internalUrl') ?? 'http://localhost:8080'
    ).replace(/\/+$/, '');
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

      // Fetch file content (SSRF guard runs first — see validateFileUrl).
      this.validateFileUrl(fileUrl);
      const fetchUrl = this.toFetchUrl(fileUrl);
      const response = await fetch(fetchUrl, {
        headers: this.uploadAuthHeaders(fetchUrl),
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${fileUrl}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract text (image uploads & sparse/scanned PDFs route through vision).
      const text = await this.resolveText(buffer, mimeType, userId);

      // Chunk
      const chunkSize = this.configService.get<number>('config.kb.chunkSize') ?? 512;
      const chunkOverlap = this.configService.get<number>('config.kb.chunkOverlap') ?? 80;
      const chunks = this.textChunker.chunk(text, chunkSize, chunkOverlap);

      if (chunks.length === 0) throw new Error('No text extracted from document');

      // Embed
      const vectors = await this.embeddingService.embed(chunks);

      // Guard against an empty/degenerate embedding result — otherwise the
      // collection would be created with an undefined dimension.
      const dimension = vectors[0]?.length;
      if (!vectors.length || !dimension) {
        throw new Error('Embedding produced no usable vectors');
      }

      // Ensure Qdrant collection exists, sized to the actual embedding dimension.
      await this.vectorStore.ensureCollection(this.collection, dimension);

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
   * Clients (web + mobile) upload with the RELATIVE `/api/uploads/{id}` that
   * chat-service returned; Node's fetch cannot resolve that, so it is fetched
   * from chat-service's internal base (same as chat vision). Absolute URLs pass.
   */
  private toFetchUrl(fileUrl: string): string {
    return fileUrl.startsWith('/') ? `${this.chatBaseUrl}${fileUrl}` : fileUrl;
  }

  /**
   * X-Internal-Key only for URLs on the internal chat-service origin; an absolute
   * fileUrl pointing anywhere else must never receive the key.
   */
  private uploadAuthHeaders(fetchUrl: string): Record<string, string> {
    try {
      if (new URL(fetchUrl).origin !== new URL(this.chatBaseUrl).origin) return {};
    } catch {
      return {};
    }
    return internalUploadHeaders({ internalApiKey: this.internalApiKey });
  }

  /**
   * SSRF guard applied before fetching a KB document. Only URLs that point at a
   * chat-service GridFS upload path are allowed. This is defense-in-depth: the
   * chat-service `KbUploadRequest.@Pattern` already rejects hostile fileUrls, but
   * ai-service re-validates so a compromised/spoofed Redis payload can never make
   * it fetch a metadata endpoint or an internal host.
   */
  private validateFileUrl(fileUrl: string): void {
    // Relative upload paths originate inside chat-service and cannot target an
    // external host — allow them straight through.
    if (fileUrl.startsWith('/api/uploads/')) return;

    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      throw new Error(`Invalid fileUrl: ${fileUrl}`);
    }

    // WHATWG URL keeps IPv6 brackets ("[::1]") and a trailing root dot
    // ("localhost.") in `hostname` — normalise both before matching.
    const isIpv6 = parsed.hostname.startsWith('[');
    const host = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');

    // Known cloud metadata hosts.
    const blockedHosts = [
      '169.254.169.254', // AWS/GCP/Azure link-local metadata
      'metadata.google.internal',
      '100.100.100.200', // Alibaba metadata
    ];
    if (blockedHosts.includes(host)) {
      throw new Error(`SSRF blocked: fileUrl points to restricted host ${host}`);
    }

    if (isPrivateHost(host, isIpv6)) {
      // Allow localhost only outside production (local dev fetches from :8080).
      const devLocalhost = process.env.NODE_ENV !== 'production' && host === 'localhost';
      if (!devLocalhost) {
        throw new Error(`SSRF blocked: fileUrl points to private IP ${host}`);
      }
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`SSRF blocked: scheme ${parsed.protocol} not allowed`);
    }

    if (!parsed.pathname.startsWith('/api/uploads/')) {
      throw new Error(`SSRF blocked: fileUrl path must be /api/uploads/*, got ${parsed.pathname}`);
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
  private async resolveText(buffer: Buffer, mimeType: string, userId?: string): Promise<string> {
    const visionUsable = this.visionEnabled && this.visionDescribe.isAvailable();

    // (a) Direct image upload.
    if (this.documentExtractor.isImage(mimeType)) {
      if (visionUsable && this.documentExtractor.isVisionSupportedImage(mimeType)) {
        try {
          const description = await this.visionDescribe.describeImage(buffer, mimeType, userId);
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
        const description = await this.visionDescribe.describePdf(buffer, userId);
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
    // Count deletions that succeeded, not ones we tried: every failure here is
    // caught and logged, so returning orphans.length would report a clean purge
    // of N documents in the same sweep where all N failed.
    let deleted = 0;
    for (const documentId of orphans) {
      try {
        await this.vectorStore.deleteDocument(this.collection, documentId);
        deleted++;
      } catch (err) {
        this.logger.warn(`Failed to purge orphan chunks for ${documentId}: ${(err as Error).message}`);
      }
    }
    if (deleted > 0) {
      this.logger.log(`Purged ${deleted} orphaned KB document(s) from vector store`);
    }
    if (deleted < orphans.length) {
      this.logger.warn(`${orphans.length - deleted} orphaned KB document(s) could not be purged`);
    }
    return deleted;
  }
}

/** Private / loopback IPv4 ranges (dotted quad, as WHATWG URL normalises it). */
const PRIVATE_IPV4 = [
  /^127\./, // loopback
  /^0\./, // "this network" — 0.0.0.0 reaches the local host on Linux
  /^10\./, // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC 1918
  /^192\.168\./, // RFC 1918
  /^169\.254\./, // link-local
];

/** Private / loopback IPv6 ranges (bracket-less, lower-case). */
const PRIVATE_IPV6 = [
  /^::1?$/, // loopback + unspecified
  /^f[cd]/, // ULA fc00::/7
  /^fe[89ab]/, // link-local fe80::/10
];

/** `::ffff:7f00:1` (WHATWG form of `::ffff:127.0.0.1`) → `127.0.0.1`. */
function ipv4FromMapped(ipv6: string): string | null {
  const m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ipv6);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
}

/** `host` is already bracket-less and without a trailing root dot. */
function isPrivateHost(host: string, isIpv6: boolean): boolean {
  if (isIpv6) {
    const mapped = ipv4FromMapped(host);
    if (mapped) return PRIVATE_IPV4.some((re) => re.test(mapped));
    return PRIVATE_IPV6.some((re) => re.test(host));
  }
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  return PRIVATE_IPV4.some((re) => re.test(host));
}
