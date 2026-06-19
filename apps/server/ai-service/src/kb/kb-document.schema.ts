import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type KbDocumentDocument = HydratedDocument<KbDocument>;

// Shared collection owned by chat-service (it creates the record on upload). ai-service only
// updates processing status/chunkCount on the same document — no separate cache copy. This keeps
// a single source of truth for KB document state across both services.
@Schema({ collection: 'kb_documents', timestamps: false })
export class KbDocument {
  @Prop({ required: true, unique: true, index: true })
  documentId: string;

  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop()
  userId: string;

  @Prop()
  fileName: string;

  @Prop()
  mimeType: string;

  @Prop({ default: 'pending' })
  status: string; // "pending" | "processing" | "done" | "error"

  @Prop({ default: 0 })
  chunkCount: number;

  @Prop({ default: () => new Date() })
  uploadedAt: Date;
}

export const KbDocumentSchema = SchemaFactory.createForClass(KbDocument);
