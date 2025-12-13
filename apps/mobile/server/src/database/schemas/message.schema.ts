import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversationId!: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId!: Types.ObjectId;
  @Prop() text?: string;
  @Prop({ type: Object }) attachment?: { url: string; type: 'image'|'file'; size?: number };
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  readBy!: Types.ObjectId[];
}
export const MessageSchema = SchemaFactory.createForClass(Message);
