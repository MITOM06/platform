import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'token_usage' })
export class TokenUsage extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  /**
   * TOTAL prompt tokens: uncached + prompt-cache writes + prompt-cache reads.
   * (Rows written before 2026-10 hold only the uncached part.)
   */
  @Prop({ default: 0 })
  inputTokens: number;

  @Prop({ default: 0 })
  outputTokens: number;

  /** Subset of `inputTokens` written to the prompt cache. */
  @Prop({ default: 0 })
  cacheCreationInputTokens: number;

  /** Subset of `inputTokens` served from the prompt cache. */
  @Prop({ default: 0 })
  cacheReadInputTokens: number;

  /** User-facing AI replies. Side calls (extraction, compaction, …) add tokens, not requests. */
  @Prop({ default: 0 })
  requestCount: number;

  @Prop()
  updatedAt: Date;
}

export const TokenUsageSchema = SchemaFactory.createForClass(TokenUsage);
TokenUsageSchema.index({ userId: 1, date: 1 }, { unique: true });
// Cross-user daily rollups (e.g. admin "total tokens used today") would otherwise scan all rows.
TokenUsageSchema.index({ date: 1 });
