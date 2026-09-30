import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { AiMemory, AiMemoryDocument } from './ai-memory.schema';
import { MemoryVectorService } from './memory-vector.service';
import { EmbeddingService } from '../kb/embedding.service';
import { redactPii, REDACT_SECRETS_ONLY } from '../common/pii-redactor';

export interface RelevantFact {
  text: string;
  score: number;
  createdAt: number;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly topFacts: number;
  private readonly dedupThreshold: number;
  private readonly halfLifeMs: number;
  /** Waits between retries of a rate-limited (429) fact embedding. Overridable in tests. */
  retryDelaysMs = [21_000, 42_000];

  constructor(
    @InjectModel(AiMemory.name) private readonly memoryModel: Model<AiMemoryDocument>,
    private readonly vectorStore: MemoryVectorService,
    private readonly embeddingService: EmbeddingService,
    private readonly configService: ConfigService,
  ) {
    this.topFacts = this.configService.get<number>('config.memory.topFacts') ?? 6;
    this.dedupThreshold = this.configService.get<number>('config.memory.dedupThreshold') ?? 0.92;
    const halfLifeDays = this.configService.get<number>('config.memory.halfLifeDays') ?? 30;
    this.halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000;
  }

  async getMemory(conversationId: string): Promise<AiMemory | null> {
    return this.memoryModel.findOne({ conversationId }).lean().exec() as Promise<AiMemory | null>;
  }

  /**
   * Retrieve only the MOST RELEVANT facts for the current message, applying a
   * recency-decay re-rank so stale facts sink. Scoped per-**user** (global): a
   * fact taught in any conversation is recalled here. Returns [] gracefully when
   * the vector collection is empty (migration-safe).
   */
  async retrieveRelevantFacts(
    userId: string,
    queryVector: number[],
  ): Promise<RelevantFact[]> {
    // Over-fetch a bit, then decay-rerank and keep topFacts.
    const candidates = await this.vectorStore.retrieve(
      userId,
      queryVector,
      Math.max(this.topFacts * 2, this.topFacts),
    );
    const now = Date.now();
    return candidates
      .map((c) => ({
        text: c.text,
        createdAt: c.createdAt,
        score: c.score * this.recencyWeight(c.createdAt, now),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topFacts);
  }

  /** Exponential recency decay: weight halves every halfLife. */
  private recencyWeight(createdAt: number, now: number): number {
    if (!createdAt) return 0.5;
    const ageMs = Math.max(0, now - createdAt);
    return Math.pow(0.5, ageMs / this.halfLifeMs);
  }

  /**
   * Fact storage runs in the background, so a 429 is worth waiting out instead of
   * dropping the facts: the per-message embeds of the live reply often exhaust a
   * low Voyage limit (3 RPM without a payment method) just before extraction runs.
   */
  private async embedWithRetry(texts: string[]): Promise<number[][]> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.embeddingService.embed(texts);
      } catch (err) {
        const delay = this.retryDelaysMs[attempt];
        if (delay === undefined || !/\b429\b/.test((err as Error).message)) throw err;
        this.logger.warn(`Fact embedding rate-limited, retrying in ${delay / 1000}s`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  /**
   * Add extracted facts with near-duplicate dedup. A fact whose nearest
   * existing neighbour exceeds the cosine dedup threshold UPDATES that point
   * (refreshing text + recency) instead of appending a duplicate. Dedup +
   * canonical rebuild are per-**user** (a fact taught in any conversation
   * dedupes against the user's whole set and is recalled everywhere).
   * Then rebuilds the canonical Mongo list + a short summary for clients.
   *
   * Returns the number of facts that were actually embedded + persisted (facts
   * skipped because they were blank or their embedding failed are NOT counted).
   * Callers that surface a result to the user (e.g. the `remember_fact` tool)
   * rely on this so they never claim a fact was stored when it silently wasn't.
   */
  async addFacts(
    conversationId: string,
    userId: string,
    facts: string[],
    summary: string,
    messageCount: number,
    source = 'auto-extract',
  ): Promise<number> {
    // Scrub credentials / card numbers before anything is persisted at rest.
    // Emails & phones are kept — they are legitimate, useful user facts.
    const safeSummary = redactPii(summary, REDACT_SECRETS_ONLY);
    const cleaned = facts
      .map((f) => redactPii(f, REDACT_SECRETS_ONLY).trim())
      .filter((f) => f.length > 0);
    // One batched embedding call for the whole extraction, not one per fact: an
    // unbilled Voyage account allows 3 requests/min, so per-fact calls 429'd
    // after the third fact and the rest were silently dropped.
    let vectors: number[][] = [];
    if (cleaned.length > 0) {
      try {
        // Only the background extraction may wait; remember_fact runs inside a
        // live reply and must fail fast rather than stall it.
        vectors =
          source === 'auto-extract'
            ? await this.embedWithRetry(cleaned)
            : await this.embeddingService.embed(cleaned);
      } catch (err) {
        this.logger.warn(`Embedding ${cleaned.length} facts failed, skipping: ${(err as Error).message}`);
      }
    }
    let stored = 0;
    for (let i = 0; i < vectors.length; i++) {
      const clean = cleaned[i];
      const vector = vectors[i];
      const nearest = await this.vectorStore.nearest(userId, vector);
      const isDup = nearest !== null && nearest.score >= this.dedupThreshold;
      await this.vectorStore.upsertFact(userId, conversationId, {
        id: isDup ? nearest!.id : undefined,
        text: clean,
        vector,
        source,
        createdAt: Date.now(),
      });
      stored++;
    }

    // Rebuild canonical fact list from the vector store for client REST/STOMP.
    const all = await this.vectorStore.listFacts(userId);
    const keyFacts = all
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((f) => f.text)
      .slice(0, 50);

    await this.memoryModel.findOneAndUpdate(
      { conversationId },
      { $set: { userId, summary: safeSummary, keyFacts, messageCount, updatedAt: new Date() } },
      { upsert: true, new: true },
    );
    return stored;
  }

  /**
   * Legacy wholesale upsert — retained for the existing client contract and
   * tests. Prefer `addFacts` for the embedding-backed path.
   */
  async upsertMemory(
    conversationId: string,
    userId: string,
    summary: string,
    keyFacts: string[],
    messageCount: number,
  ): Promise<void> {
    await this.memoryModel.findOneAndUpdate(
      { conversationId },
      { $set: { userId, summary, keyFacts, messageCount, updatedAt: new Date() } },
      { upsert: true, new: true },
    );
  }

  async deleteMemory(conversationId: string): Promise<void> {
    await this.memoryModel.deleteOne({ conversationId });
    await this.vectorStore.deleteConversation(conversationId);
  }

  /**
   * Retention: purge embedded facts older than `cutoffMs` from the vector store.
   * The canonical Mongo `keyFacts` list self-heals on the next extraction; we
   * leave it untouched here to avoid a full re-scan on every purge.
   */
  async purgeFactsOlderThan(cutoffMs: number): Promise<boolean> {
    return this.vectorStore.deleteOlderThan(cutoffMs);
  }

  async incrementMessageCount(conversationId: string): Promise<number> {
    const result = await this.memoryModel.findOneAndUpdate(
      { conversationId },
      { $inc: { messageCount: 1 } },
      { upsert: true, new: true },
    );
    return result?.messageCount ?? 1;
  }
}
