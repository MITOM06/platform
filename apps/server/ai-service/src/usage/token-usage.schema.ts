import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'token_usage' })
export class TokenUsage extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ default: 0 })
  inputTokens: number;

  @Prop({ default: 0 })
  outputTokens: number;

  @Prop({ default: 0 })
  requestCount: number;

  @Prop()
  updatedAt: Date;
}

export const TokenUsageSchema = SchemaFactory.createForClass(TokenUsage);
TokenUsageSchema.index({ userId: 1, date: 1 }, { unique: true });
// Cross-user daily rollups (e.g. admin "total tokens used today") would otherwise scan all rows.
TokenUsageSchema.index({ date: 1 });
