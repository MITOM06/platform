import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  recipient: Types.ObjectId; // 1-1; nếu group => dùng conversationId

  @Prop({ type: String })
  content: string;

  @Prop({ type: String, enum: ['text', 'image', 'file'], default: 'text' })
  type: 'text' | 'image' | 'file';

  @Prop({ type: Boolean, default: false })
  seen: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });

