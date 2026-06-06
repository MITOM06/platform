import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiMemoryDocument = AiMemory & Document;

@Schema({ collection: 'ai_memories', timestamps: false })
export class AiMemory {
  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, default: '' })
  summary: string;

  @Prop({ type: [String], default: [] })
  keyFacts: string[];

  @Prop({ default: 0 })
  messageCount: number;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const AiMemorySchema = SchemaFactory.createForClass(AiMemory);
AiMemorySchema.index({ conversationId: 1, userId: 1 }, { unique: true });
