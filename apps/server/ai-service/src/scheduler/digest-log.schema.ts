import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DigestLogDocument = DigestLog & Document;

/**
 * Idempotency ledger for the daily-digest cron (TASK-11). One row per
 * `{conversationId, digestDate}`, inserted BEFORE generating the digest. The
 * UNIQUE compound index makes a duplicate insert fail (duplicate-key error), so
 * a redeploy mid-run or two instances racing the same tick never double-post.
 *
 * `digestDate` = `YYYY-MM-DD` of the SUMMARIZED day ("yesterday"), not the run
 * time. Mirrors `@platform/database`'s `ai_digest_log` schema; ai-service owns
 * the writes to this collection.
 */
@Schema({ collection: 'ai_digest_log' })
export class DigestLog {
  @Prop({ type: String, required: true })
  conversationId: string;

  @Prop({ type: String, required: true })
  digestDate: string;

  @Prop({ type: Date, default: () => new Date() })
  createdAt: Date;
}

export const DigestLogSchema = SchemaFactory.createForClass(DigestLog);

// One digest per conversation per summarized day (idempotency guarantee).
DigestLogSchema.index({ conversationId: 1, digestDate: 1 }, { unique: true });
