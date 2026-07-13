import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Capability } from '../rbac/capabilities';

export type AiContextEntryDocument = AiContextEntry & Document;
export type ContextScope = 'company' | 'department';

/**
 * A curated company- or department-level context note fed into the AI prompt.
 * `requiredCapability` gates sensitivity: null = public; otherwise only users
 * whose resolved `perms` include that capability receive the entry.
 */
@NestSchema({ timestamps: true, collection: 'ai_context_entries' })
export class AiContextEntry {
  @Prop({ required: true, enum: ['company', 'department'], index: true })
  scope: ContextScope;

  /** null for company scope; the departmentId string for department scope. */
  @Prop({ type: String, default: null, index: true })
  scopeId: string | null;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  text: string;

  /** null = public. Otherwise a Capability key required to receive this entry. */
  @Prop({ type: String, default: null })
  requiredCapability: Capability | null;

  @Prop({ required: true })
  createdBy: string;

  @Prop({ required: true })
  updatedBy: string;
}

export const AiContextEntrySchema = SchemaFactory.createForClass(AiContextEntry);
