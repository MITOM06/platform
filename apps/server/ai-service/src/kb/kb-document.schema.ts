import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type KbDocumentDocument = HydratedDocument<KbDocument>;

@Schema({ collection: 'kb_documents_ai_cache', timestamps: false })
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
