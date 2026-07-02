import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiSessionDocument = AiSession & Document;

/**
 * One turn stored in an AI session's full history. Text-only (`role` + `content`);
 * images / attachments are not persisted in the session (the session is the
 * AI-layer source of truth for the *textual* conversation history).
 */
export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

/**
 * An AI conversation session (ai-service owns this collection). One chat-service
 * `conversation` maps to MANY sessions — a session is an AI-layer concept that
 * lets a user explicitly reset context (`/new`) while keeping older history
 * resumable. Exactly one session per (user, conversation) is `isActive` at a time.
 */
@Schema({ timestamps: true, collection: 'ai_sessions' })
export class AiSession {
  @Prop({ required: true, index: true })
  userId: string;

  /** ID of the conversation in chat-service this session belongs to. */
  @Prop({ required: true, index: true })
  conversationId: string;

  /** Auto-generated (Haiku) from the first user message; falls back to default. */
  @Prop({ required: true, default: 'New conversation' })
  name: string;

  /** Full textual history of this session. */
  @Prop({ type: [Object], default: [] })
  messages: SessionMessage[];

  /** Rolling summary of compacted (older) turns; null until first compaction. */
  @Prop({ type: String, default: null })
  summary: string | null;

  /** Only one active session per (user, conversation). */
  @Prop({ default: false })
  isActive: boolean;

  /** Estimated token count (chars/4) used to trigger auto-compaction. */
  @Prop({ default: 0 })
  totalTokens: number;

  createdAt: Date;

  updatedAt: Date;
}

export const AiSessionSchema = SchemaFactory.createForClass(AiSession);
// Fast lookup of a user's sessions within a conversation, active first.
AiSessionSchema.index({ userId: 1, conversationId: 1, isActive: -1 });
