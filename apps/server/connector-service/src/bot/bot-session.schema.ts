import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BotSessionDocument = BotSession & Document;

/**
 * Maps a Bot Factory bot identity to a PON member. The plaintext token is
 * never stored — only its SHA-256 hash so a DB breach cannot replay tokens.
 * One active session per (userId, botUserId) pair; issuing a new token revokes
 * the previous one automatically (findOneAndUpdate with upsert).
 */
@Schema({ collection: 'bot_sessions', timestamps: true })
export class BotSession {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true }) botUserId: string;

  /** SHA-256 hex of the plaintext token. Indexed for O(1) lookup on every request. */
  @Prop({ required: true, index: true }) tokenHash: string;

  /** Nullable — set on revoke(). Active sessions have revokedAt: null. */
  @Prop({ default: null }) revokedAt: Date | null;

  @Prop() lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const BotSessionSchema = SchemaFactory.createForClass(BotSession);
// Compound index: only one active session per (userId, botUserId)
BotSessionSchema.index({ userId: 1, botUserId: 1 });
