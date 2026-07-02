import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiSession, AiSessionDocument } from '@platform/database';
import { ClaudeClientService } from './claude-client.service';

/**
 * Compact when the estimated session token count crosses this threshold, leaving
 * enough headroom below the model's context window for grounding + response.
 */
export const COMPACT_THRESHOLD_TOKENS = 80_000;

/** Fraction of the most recent messages kept verbatim (rest are summarized). */
const KEEP_RECENT_FRACTION = 0.2;

export interface CompactResult {
  session: AiSessionDocument;
  compacted: boolean;
}

/**
 * Auto-summarizes older turns of a session when it grows near the context limit
 * so the conversation can continue without silently dropping context. The full
 * history stays in Mongo; only what is *sent to Claude* is compacted.
 */
@Injectable()
export class CompactService {
  private readonly logger = new Logger(CompactService.name);

  constructor(
    @InjectModel(AiSession.name) private readonly model: Model<AiSessionDocument>,
    private readonly claudeClient: ClaudeClientService,
  ) {}

  /** Compact the session if it exceeds the threshold. Call before building history. */
  async maybeCompact(session: AiSessionDocument): Promise<CompactResult> {
    if (session.totalTokens < COMPACT_THRESHOLD_TOKENS) {
      return { session, compacted: false };
    }
    try {
      const compacted = await this.compact(session);
      return { session: compacted, compacted: true };
    } catch (err) {
      // Hard safety fallback: if summarization fails, keep the most recent
      // messages so the request can still proceed rather than blowing the window.
      this.logger.error(`Compaction failed for session ${session._id}; applying safety trim`, err as Error);
      const trimmed = await this.safetyTrim(session);
      return { session: trimmed, compacted: false };
    }
  }

  private async compact(session: AiSessionDocument): Promise<AiSessionDocument> {
    const history = session.messages;
    const keepCount = Math.max(1, Math.ceil(history.length * KEEP_RECENT_FRACTION));
    // Ensure the kept slice begins on a `user` turn. Otherwise the summary
    // priming in buildMessageHistory (synthetic user + assistant) would sit
    // directly before a kept `assistant` turn → two consecutive `assistant`
    // turns → Anthropic 400 every turn until the next compaction.
    let splitIndex = history.length - keepCount;
    while (splitIndex < history.length && history[splitIndex].role === 'assistant') {
      splitIndex++;
    }
    const toSummarize = history.slice(0, splitIndex);
    const toKeep = history.slice(splitIndex);

    if (toSummarize.length === 0) {
      return session; // nothing old enough to summarize
    }

    const summary = await this.claudeClient.summarize(
      toSummarize.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
    );

    // The model can return no text block (empty string, NOT an exception). Treat
    // that as a summarization failure and fall through to the safety-trim path
    // (keep recent turns, do NOT set a summary) rather than silently dropping the
    // older turns with an empty summary that buildMessageHistory then ignores.
    if (!summary.trim()) {
      throw new Error('Summarization returned an empty summary');
    }

    // Layered summaries: fold in any previous summary.
    const fullSummary = session.summary
      ? `${session.summary}\n\n[Later conversation summary]\n${summary}`
      : summary;

    const keptTokens = toKeep.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const summaryTokens = Math.ceil(fullSummary.length / 4);

    await this.model.updateOne(
      { _id: session._id },
      { $set: { messages: toKeep, summary: fullSummary, totalTokens: keptTokens + summaryTokens } },
    );

    this.logger.log(
      `Compacted session ${session._id}: ${toSummarize.length} turns → summary, kept ${toKeep.length} recent turns`,
    );

    return (await this.model.findById(session._id))!;
  }

  /** Fallback when summarization is unavailable: keep only the recent slice. */
  private async safetyTrim(session: AiSessionDocument): Promise<AiSessionDocument> {
    const history = session.messages;
    const keepCount = Math.max(1, Math.ceil(history.length * KEEP_RECENT_FRACTION));
    const toKeep = history.slice(history.length - keepCount);
    const keptTokens = toKeep.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    await this.model.updateOne(
      { _id: session._id },
      { $set: { messages: toKeep, totalTokens: keptTokens } },
    );
    return (await this.model.findById(session._id))!;
  }
}
