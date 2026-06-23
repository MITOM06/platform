import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

/**
 * Embedded agent-trace subdocument written by chat-service on AI messages
 * (`AiTraceData.java`). Only the fields the usage dashboard needs are mapped —
 * per-model token counts for cost estimation (TASK-13, decision D5).
 */
@Schema({ _id: false })
export class AiTrace {
  @Prop()
  model?: string;

  @Prop({ default: 0 })
  inputTokens?: number;

  @Prop({ default: 0 })
  outputTokens?: number;
}

export const AiTraceSchema = SchemaFactory.createForClass(AiTrace);

/**
 * Read model over the SHARED `messages` collection (owned/written by
 * chat-service). ai-service reads it ONLY to aggregate per-model token usage
 * (via `trace`) and to resolve the answer preview for down-rated messages.
 * ai-service NEVER writes this collection. Mirrors the read-only
 * `conversation.schema.ts` pattern.
 */
@Schema({ collection: 'messages' })
export class Message {
  @Prop()
  conversationId?: string;

  @Prop()
  senderId?: string;

  @Prop()
  content?: string;

  @Prop({ type: AiTraceSchema, default: null })
  trace?: AiTrace | null;

  @Prop()
  createdAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
