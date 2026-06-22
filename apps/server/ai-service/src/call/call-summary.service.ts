import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Anthropic from '@anthropic-ai/sdk';
import Redis from 'ioredis';
import { REDIS_PUBLISHER } from '../redis/redis.constants';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { CallSession, CallSessionDocument } from './call-session.schema';
import { User, UserDocument } from './user.schema';

/** Redis pub/sub channel chat-service publishes to request a summary. */
export const CALL_SUMMARIZE_CHANNEL = 'call:summarize';
/** Redis pub/sub channel ai-service publishes the finished summary to. */
export const CALL_SUMMARY_RESULT_CHANNEL = 'call:summary:result';
/** STT transcript buffer key (list of JSON segments). */
export const callTranscriptKey = (callId: string): string => `call:transcript:${callId}`;

/** Inbound `call:summarize` message. */
export interface CallSummarizeMessage {
  callId: string;
  conversationId: string;
}

/** One STT segment as stored by chat-service in the transcript list. */
export interface TranscriptSegment {
  userId: string;
  displayName: string;
  text: string;
  ts: number;
}

/** Structured summary the model is asked to return. */
export interface SummaryPayload {
  attendees: string[];
  durationSec: number;
  overview: string;
  keyPoints: string[];
  actionItems: string[];
}

@Injectable()
export class CallSummaryService {
  private readonly logger = new Logger(CallSummaryService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly redis: Redis,
    @InjectModel(CallSession.name)
    private readonly callSessionModel: Model<CallSessionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly publisher: RedisPublisherService,
    private readonly configService: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('config.anthropic.apiKey'),
    });
    // Reuse the configured primary model (Opus 4.8 by default).
    this.model = this.configService.get<string>('config.anthropic.model') ?? 'claude-opus-4-8';
  }

  /**
   * Produce and publish a meeting summary for a finished call.
   * No-op (publishes nothing) when the transcript buffer is empty.
   */
  async summarize(msg: CallSummarizeMessage): Promise<void> {
    const { callId, conversationId } = msg;

    const segments = await this.loadSegments(callId);
    if (segments.length === 0) {
      this.logger.log(`No transcript for call ${callId}; skipping summary.`);
      return;
    }

    const session = await this.callSessionModel.findOne({ callId }).lean().exec();

    // chat-service is userId-only: transcript segments and participant
    // displayNames are raw userIds. Resolve them to human names in ONE query.
    const ids = CallSummaryService.collectUserIds(segments, session?.participants ?? []);
    const nameMap = await this.resolveDisplayNames(ids);

    const transcript = CallSummaryService.renderTranscriptLines(segments, nameMap);
    const { attendees, durationSec } = CallSummaryService.deriveSessionMeta(
      session,
      segments,
      nameMap,
      callId,
      this.logger,
    );

    const summary = await this.generateSummary(transcript);

    const payload: SummaryPayload = {
      attendees,
      durationSec,
      overview: summary.overview,
      keyPoints: summary.keyPoints,
      actionItems: summary.actionItems,
    };

    await this.publisher.publishToChannel(CALL_SUMMARY_RESULT_CHANNEL, {
      conversationId,
      callId,
      payload,
    });
    this.logger.log(
      `Published summary for call ${callId} (${attendees.length} attendees, ${durationSec}s).`,
    );
  }

  /** LRANGE the transcript buffer and parse each JSON segment, ordered by ts. */
  private async loadSegments(callId: string): Promise<TranscriptSegment[]> {
    const raw = await this.redis.lrange(callTranscriptKey(callId), 0, -1);
    return CallSummaryService.parseSegments(raw);
  }

  /** Parse + sort raw transcript entries; malformed entries are dropped. */
  static parseSegments(raw: string[]): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    for (const entry of raw) {
      try {
        const parsed = JSON.parse(entry) as Partial<TranscriptSegment>;
        if (typeof parsed.text !== 'string' || parsed.text.trim() === '') continue;
        segments.push({
          userId: typeof parsed.userId === 'string' ? parsed.userId : '',
          displayName:
            typeof parsed.displayName === 'string' && parsed.displayName.trim()
              ? parsed.displayName
              : 'Unknown',
          text: parsed.text,
          ts: typeof parsed.ts === 'number' ? parsed.ts : 0,
        });
      } catch {
        // Skip malformed segment.
      }
    }
    return segments.sort((a, b) => a.ts - b.ts);
  }

  /**
   * Render ordered segments into `resolvedName: text` lines. `nameMap` maps a
   * raw userId to a human display name; unresolved ids fall back to the raw id
   * (or the segment's stored name when no userId is present).
   */
  static renderTranscriptLines(
    segments: TranscriptSegment[],
    nameMap: Map<string, string> = new Map(),
  ): string {
    return segments
      .map((s) => `${CallSummaryService.resolveName(s.userId, nameMap, s.displayName)}: ${s.text}`)
      .join('\n');
  }

  /**
   * Collect the distinct raw userIds referenced by the transcript segments and
   * the session participants. Blank ids are ignored.
   */
  static collectUserIds(
    segments: TranscriptSegment[],
    participants: { userId?: string }[],
  ): string[] {
    const ids = [
      ...segments.map((s) => s.userId),
      ...participants.map((p) => p.userId ?? ''),
    ].filter((id): id is string => typeof id === 'string' && id.trim() !== '');
    return CallSummaryService.distinct(ids);
  }

  /**
   * Batch-load display names for the given userIds in ONE query. Ids that
   * aren't valid ObjectIds or don't resolve are simply absent from the map
   * (callers fall back to the raw id).
   */
  private async resolveDisplayNames(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;

    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) return map;

    try {
      const users = await this.userModel
        .find({ _id: { $in: objectIds } }, { displayName: 1 })
        .lean()
        .exec();
      for (const u of users) {
        const name = typeof u.displayName === 'string' ? u.displayName.trim() : '';
        if (name) map.set(String(u._id), name);
      }
    } catch (err) {
      this.logger.warn(`Failed to resolve display names: ${(err as Error).message}`);
    }
    return map;
  }

  /**
   * Resolve a userId to a display name via the map, falling back to a provided
   * default (e.g. the segment's stored name) and finally to the raw userId.
   */
  static resolveName(
    userId: string | undefined,
    nameMap: Map<string, string>,
    fallback?: string,
  ): string {
    if (userId && nameMap.has(userId)) return nameMap.get(userId) as string;
    if (userId && userId.trim() !== '') return userId;
    if (fallback && fallback.trim() !== '') return fallback;
    return 'Unknown';
  }

  /**
   * Attendees = distinct RESOLVED display names of participants who joined;
   * duration from the CallSession start/end. Falls back to transcript speakers
   * and a 0 duration when the session document is missing.
   */
  static deriveSessionMeta(
    session: Pick<CallSession, 'participants' | 'startedAt' | 'endedAt'> | null,
    segments: TranscriptSegment[],
    nameMap: Map<string, string>,
    callId: string,
    logger?: Logger,
  ): { attendees: string[]; durationSec: number } {
    if (!session) {
      logger?.warn(`CallSession ${callId} not found; deriving attendees from transcript.`);
      return {
        attendees: CallSummaryService.distinct(
          segments.map((s) => CallSummaryService.resolveName(s.userId, nameMap, s.displayName)),
        ),
        durationSec: 0,
      };
    }

    const attendees = CallSummaryService.distinct(
      (session.participants ?? [])
        .filter((p) => p.joinedAt != null)
        .map((p) => CallSummaryService.resolveName(p.userId, nameMap, p.displayName)),
    );

    const durationSec = CallSummaryService.computeDurationSec(session.startedAt, session.endedAt);
    return { attendees, durationSec };
  }

  static distinct(values: string[]): string[] {
    return Array.from(new Set(values));
  }

  static computeDurationSec(startedAt?: Date | null, endedAt?: Date | null): number {
    if (!startedAt || !endedAt) return 0;
    const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    return ms > 0 ? Math.round(ms / 1000) : 0;
  }

  /** Call Claude for a STRICT-JSON structured summary, robustly parsed. */
  private async generateSummary(
    transcript: string,
  ): Promise<{ overview: string; keyPoints: string[]; actionItems: string[] }> {
    const system =
      'You are PON AI, summarizing a meeting transcript for the participants. ' +
      'Read the transcript (each line is "Speaker: text") and produce a concise, ' +
      'accurate summary. Respond with STRICT JSON only — no prose, no markdown, no ' +
      'code fences — exactly matching this shape: ' +
      '{ "overview": string, "keyPoints": string[], "actionItems": string[] }. ' +
      '"overview" is 1-3 sentences. "keyPoints" are the main discussion points. ' +
      '"actionItems" are concrete follow-ups/owners; use an empty array if there are none. ' +
      'Reply in the dominant language of the transcript.';

    try {
      const res = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: `Transcript:\n\n${transcript}` }],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      return CallSummaryService.parseSummaryJson(text);
    } catch (err) {
      this.logger.error(`Claude summarization failed: ${(err as Error).message}`, err as Error);
      return { overview: 'Summary unavailable.', keyPoints: [], actionItems: [] };
    }
  }

  /**
   * Parse the model's JSON output. Strips code fences and locates the first
   * JSON object if extra text leaks in. On failure, falls back to using the
   * raw text as the overview with empty arrays.
   */
  static parseSummaryJson(raw: string): {
    overview: string;
    keyPoints: string[];
    actionItems: string[];
  } {
    const cleaned = CallSummaryService.stripFences(raw);
    try {
      const obj = JSON.parse(cleaned) as Record<string, unknown>;
      return {
        overview: typeof obj.overview === 'string' ? obj.overview : '',
        keyPoints: CallSummaryService.toStringArray(obj.keyPoints),
        actionItems: CallSummaryService.toStringArray(obj.actionItems),
      };
    } catch {
      return { overview: raw.trim(), keyPoints: [], actionItems: [] };
    }
  }

  /** Remove ```json fences and isolate the first {...} block if present. */
  static stripFences(raw: string): string {
    let s = raw.trim();
    const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(s);
    if (fence) s = fence[1].trim();
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      s = s.slice(start, end + 1);
    }
    return s;
  }

  static toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v !== '');
  }
}
