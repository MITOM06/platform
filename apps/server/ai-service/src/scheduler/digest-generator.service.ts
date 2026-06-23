import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Anthropic from '@anthropic-ai/sdk';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { ResolvedAiSettings } from '../settings/resolved-ai-settings';
import { yesterdayWindow } from './digest-date.util';

/** One transcript row pulled from the shared `messages` collection. */
interface TranscriptRow {
  senderId: string;
  content: string;
}

/**
 * Generates a digest of YESTERDAY's conversation activity and delivers it as a
 * synthetic `AI_STREAM_DONE` to Redis `ai:response:{conversationId}` — the
 * existing chat-service `AiResponseListener` then persists+broadcasts it as a
 * normal `type:"ai"` message (TASK-11, Decision 1/4). Mirrors
 * `CallSummaryService.generateSummary()`'s non-streaming Anthropic call.
 *
 * Reads the shared `messages` collection the same way `SearchMessagesTool` does
 * (`connection.collection('messages')`) — ai-service owns no `messages` model.
 */
@Injectable()
export class DigestGeneratorService {
  private readonly logger = new Logger(DigestGeneratorService.name);
  private readonly anthropic: Anthropic;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly publisher: RedisPublisherService,
    private readonly configService: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
  }

  /**
   * Build + deliver the digest for one conversation. Returns true if a digest
   * was generated and published, false if skipped (no activity yesterday).
   * NEVER throws the failure outward beyond the Anthropic call's own guard —
   * the caller still treats a thrown error as "rollback the log row".
   */
  async generateAndDeliver(
    conversationId: string,
    settings: ResolvedAiSettings,
    now: Date = new Date(),
  ): Promise<boolean> {
    const rows = await this.loadYesterday(conversationId, now);
    if (rows.length === 0) {
      this.logger.debug(`No activity yesterday for ${conversationId}; skipping digest.`);
      return false;
    }

    const transcript = await this.renderTranscript(rows);
    const digestText = await this.summarize(transcript, settings);
    if (!digestText.trim()) {
      this.logger.warn(`Empty digest for ${conversationId}; not delivering.`);
      return false;
    }

    await this.publisher.publish(conversationId, {
      type: 'AI_STREAM_DONE',
      fullContent: digestText,
      sources: [],
      trace: null,
    });
    this.logger.log(`Delivered daily digest for conversation ${conversationId}.`);
    return true;
  }

  /** Read yesterday's user/ai messages for the conversation (local-day window). */
  private async loadYesterday(conversationId: string, now: Date): Promise<TranscriptRow[]> {
    const { start, end } = yesterdayWindow(now);
    const messages = this.connection.collection('messages');
    const docs = await messages
      .find({
        conversationId,
        createdAt: { $gte: start, $lt: end },
        type: { $in: ['text', 'ai'] },
        recalled: { $ne: true },
      })
      .sort({ createdAt: 1 })
      .toArray();
    return docs.map((m) => ({
      senderId: String(m['senderId'] ?? ''),
      content: String(m['content'] ?? ''),
    }));
  }

  /** Resolve senderIds → display names (one query) and render `Name: text` lines. */
  private async renderTranscript(rows: TranscriptRow[]): Promise<string> {
    const users = this.connection.collection('users');
    const senderIds = [...new Set(rows.map((r) => r.senderId).filter(Boolean))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userDocs = await users.find({ _id: { $in: senderIds } } as any).toArray();
    const nameMap = new Map(userDocs.map((u) => [String(u['_id']), String(u['displayName'] ?? '')]));
    return rows
      .filter((r) => r.content.trim() !== '')
      .map((r) => `${nameMap.get(r.senderId) || r.senderId || 'Unknown'}: ${r.content}`)
      .join('\n');
  }

  /**
   * Resolve the digest model: explicit AI_DIGEST_MODEL wins; else map the
   * workspace modelTier to the router model, defaulting to the FAST tier
   * (simpleModel) to control cost on a daily batch job.
   */
  private resolveModel(settings: ResolvedAiSettings): string {
    const explicit = this.configService.get<string>('config.digest.model');
    if (explicit) return explicit;
    const router = 'config.anthropic.router';
    const simple = this.configService.get<string>(`${router}.simpleModel`) ?? 'claude-haiku-4-5';
    const mid = this.configService.get<string>(`${router}.midModel`) ?? 'claude-sonnet-4-6';
    const complex = this.configService.get<string>(`${router}.complexModel`) ?? 'claude-opus-4-8';
    switch (settings.modelTier) {
      case 'mid':
        return mid;
      case 'complex':
        return complex;
      // 'auto' and 'simple' ⇒ fast/cheap tier for the batch job.
      default:
        return simple;
    }
  }

  /** Non-streaming summary call mirroring CallSummaryService.generateSummary(). */
  private async summarize(transcript: string, settings: ResolvedAiSettings): Promise<string> {
    const system =
      'You are PON AI, writing a short DAILY DIGEST of yesterday\'s conversation for the ' +
      'participants. Read the transcript (each line is "Speaker: text") and produce a concise, ' +
      'friendly recap: a 1-2 sentence overview, then the key discussion points and any concrete ' +
      'follow-ups / action items as short bullet lines. Plain text/markdown — NO code fences. ' +
      'Reply in the dominant language of the transcript. If there was little of substance, keep ' +
      'it to a single sentence.';
    try {
      const res = await this.anthropic.messages.create({
        model: this.resolveModel(settings),
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: `Transcript:\n\n${transcript}` }],
      });
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
    } catch (err) {
      this.logger.error(`Digest summarization failed: ${(err as Error).message}`, err as Error);
      return '';
    }
  }
}
