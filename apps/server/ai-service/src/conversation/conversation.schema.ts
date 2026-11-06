import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

/**
 * Read model over the SHARED `conversations` collection (owned by chat-service).
 * ai-service reads `participants` (and `meetingId`) to verify the requester may use the AI in
 * this conversation (defense-in-depth — chat-service is the primary gate).
 */
@Schema({ collection: 'conversations' })
export class Conversation {
  @Prop({ type: [String], default: [] })
  participants: string[];

  /** Set on post-meeting group chats created from a meeting (read-only here). */
  @Prop({ type: String, default: null })
  meetingId?: string | null;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
