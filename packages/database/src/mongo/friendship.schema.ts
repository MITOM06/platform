import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FriendshipDocument = Friendship & Document;

export type FriendshipStatus = 'pending' | 'accepted';

// Pinned explicitly (same name Mongoose would derive) because chat-service reads this collection
// via `@Document(collection = "friendships")`. See shared-collections.spec.ts.
@NestSchema({ timestamps: true, collection: 'friendships' })
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

// "Pending requests received by user X" — the single-field recipientId index can't
// filter on status efficiently, so back that common query with a compound index.
FriendshipSchema.index({ recipientId: 1, status: 1 });
