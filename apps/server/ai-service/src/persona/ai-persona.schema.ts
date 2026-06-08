import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'ai_personas' })
export class AiPersona extends Document {
  @Prop({ required: true, unique: true, index: true })
  conversationId: string;

  @Prop({ default: 'PON AI' })
  name: string;

  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  @Prop({ default: 'friendly' })
  tone: string;

  @Prop({ type: String, default: null })
  systemPromptPrefix: string | null;

  @Prop({ required: true })
  createdBy: string;

  @Prop({ default: () => new Date() })
  updatedAt: Date;
}

export const AiPersonaSchema = SchemaFactory.createForClass(AiPersona);
