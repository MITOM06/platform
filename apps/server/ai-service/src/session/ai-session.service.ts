import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiSession, AiSessionDocument } from '@platform/database';
import { ClaudeClientService } from './claude-client.service';

/** A message pair prepared for the Anthropic messages API. */
export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Rough token estimate without an external tokenizer (chars / 4). */
function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}

/**
 * Owns the `ai_sessions` collection. The active session is the AI-layer source
 * of truth for a conversation's textual history — ai-service builds Claude
 * requests from the session, not from the RabbitMQ `payload.history`.
 */
@Injectable()
export class AiSessionService {
  private readonly logger = new Logger(AiSessionService.name);

  constructor(
    @InjectModel(AiSession.name) private readonly model: Model<AiSessionDocument>,
    private readonly claudeClient: ClaudeClientService,
  ) {}

  /** Return the active session for (user, conversation), creating one if none. */
  async getOrCreateActiveSession(
    userId: string,
    conversationId: string,
  ): Promise<AiSessionDocument> {
    const existing = await this.model.findOne({ userId, conversationId, isActive: true });
    if (existing) return existing;
    return this.model.create({
      userId,
      conversationId,
      name: 'New conversation',
      messages: [],
      isActive: true,
      totalTokens: 0,
    });
  }

  /** Append a message to a session and bump the estimated token counter. */
  async appendMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<void> {
    await this.model.updateOne(
      { _id: sessionId },
      {
        $push: { messages: { role, content, createdAt: new Date() } },
        $inc: { totalTokens: estimateTokens(content) },
      },
    );
    // Auto-name from the first user message (fire-and-forget, non-blocking).
    const session = await this.model.findById(sessionId).select('messages name');
    if (session && session.messages.length === 1 && session.name === 'New conversation') {
      void this.autoNameSession(session);
    }
  }

  /** Deactivate the current active session and start a fresh one (`/new`). */
  async createNewSession(userId: string, conversationId: string): Promise<AiSessionDocument> {
    await this.model.updateMany(
      { userId, conversationId, isActive: true },
      { $set: { isActive: false } },
    );
    return this.model.create({
      userId,
      conversationId,
      name: 'New conversation',
      messages: [],
      isActive: true,
      totalTokens: 0,
    });
  }

  /** Resume an older session: deactivate the current one, activate the target. */
  async resumeSession(
    sessionId: string,
    userId: string,
    conversationId: string,
  ): Promise<AiSessionDocument | null> {
    const target = await this.model.findOne({ _id: sessionId, userId, conversationId });
    if (!target) return null;
    await this.model.updateMany(
      { userId, conversationId, isActive: true },
      { $set: { isActive: false } },
    );
    target.isActive = true;
    await target.save();
    return target;
  }

  /** List a user's sessions in a conversation, active first then newest. */
  async listSessions(userId: string, conversationId: string): Promise<AiSessionDocument[]> {
    return this.model
      .find({ userId, conversationId })
      .sort({ isActive: -1, updatedAt: -1 })
      .select('name isActive totalTokens createdAt updatedAt summary')
      .limit(50);
  }

  /** Rename a session (ownership-scoped). Returns null if not owned/found. */
  async renameSession(
    sessionId: string,
    userId: string,
    name: string,
  ): Promise<AiSessionDocument | null> {
    const trimmed = (name ?? '').trim().slice(0, 80) || 'New conversation';
    const session = await this.model.findOne({ _id: sessionId, userId });
    if (!session) return null;
    session.name = trimmed;
    await session.save();
    return session;
  }

  /**
   * Build the message history to send to Claude. When the session has been
   * compacted, the rolling summary is prepended as a synthetic user/assistant
   * exchange so the model retains earlier context.
   */
  async buildMessageHistory(session: AiSessionDocument): Promise<HistoryTurn[]> {
    const recent = session.messages.map((m) => ({ role: m.role, content: m.content }));
    if (session.summary) {
      return [
        { role: 'user', content: `[Context from earlier conversation]\n${session.summary}` },
        {
          role: 'assistant',
          content: 'Understood. I have the context from our earlier conversation.',
        },
        ...recent,
      ];
    }
    return recent;
  }

  /** Auto-name the session from its first message using Haiku (non-critical). */
  private async autoNameSession(session: AiSessionDocument): Promise<void> {
    try {
      const firstMessage = session.messages[0]?.content ?? '';
      const name = await this.claudeClient.generateTitle(firstMessage);
      await this.model.updateOne({ _id: session._id }, { $set: { name } });
    } catch (err) {
      this.logger.warn(`Auto-naming session ${session._id} failed`, err as Error);
    }
  }
}
