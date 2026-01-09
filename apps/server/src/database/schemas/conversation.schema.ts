import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Conversation extends Document {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  memberIds!: Types.ObjectId[];
  @Prop({ type: Date }) lastMessageAt?: Date;
}
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
