import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiDigestLogDocument = AiDigestLog & Document;

/**
 * Idempotency ledger for the ai-service daily-digest cron (TASK-11). The cron
 * inserts ONE row per `{conversationId, digestDate}` BEFORE generating the
 * digest; the UNIQUE compound index makes a duplicate insert (e.g. on a
 * redeploy mid-run, or two instances racing the same hourly tick) fail fast, so
 * a digest is generated/delivered at most once per conversation per day.
 *
 * `digestDate` is the `YYYY-MM-DD` of the SUMMARIZED day (i.e. "yesterday"
 * relative to the tick), NOT the run timestamp.
 */
@NestSchema({ collection: 'ai_digest_log' })
export class AiDigestLog {
  /** The conversation the digest was posted into. */
  @Prop({ type: String, required: true })
  conversationId: string;

  /** `YYYY-MM-DD` of the summarized day. Part of the unique idempotency key. */
  @Prop({ type: String, required: true })
  digestDate: string;

  /** When the log row (and thus the digest run) was created. */
  @Prop({ type: Date, default: () => new Date() })
  createdAt: Date;
}

export const AiDigestLogSchema = SchemaFactory.createForClass(AiDigestLog);

// Unique idempotency key: one digest per conversation per summarized day.
AiDigestLogSchema.index({ conversationId: 1, digestDate: 1 }, { unique: true });
