import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiUserContextDocument = AiUserContext & Document;

/**
 * Per-user AI context profile. Hard fields (jobTitle, projects) are edited only
 * by superiors; soft fields (style, preferences) are edited only by the owning
 * user. Role & department NAMES are NOT stored here — derive from User/Role/Department.
 */
@NestSchema({ timestamps: true, collection: 'ai_user_context' })
export class AiUserContext {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  @Prop({ default: '' })
  jobTitle: string;

  @Prop({ type: [String], default: [] })
  projects: string[];

  @Prop({ default: '' })
  style: string;

  @Prop({ default: '' })
  preferences: string;

  @Prop({ required: true })
  updatedBy: string;
}

export const AiUserContextSchema = SchemaFactory.createForClass(AiUserContext);
