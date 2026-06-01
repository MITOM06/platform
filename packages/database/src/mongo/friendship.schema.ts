import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FriendshipDocument = Friendship & Document;

export type FriendshipStatus = 'pending' | 'accepted';

@NestSchema({ timestamps: true })
export class Friendship {
  @Prop({ required: true, index: true })
  requesterId: string;

  @Prop({ required: true, index: true })
  recipientId: string;

  @Prop({ default: 'pending' })
  status: FriendshipStatus;
}

export const FriendshipSchema = SchemaFactory.createForClass(Friendship);

// A pair of users can only have a single friendship document (in one direction).
FriendshipSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true });
