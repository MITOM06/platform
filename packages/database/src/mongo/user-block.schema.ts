import { Prop, Schema as NestSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserBlockDocument = UserBlock & Document;

/**
 * One row per (blocker → blocked) relationship. Replaces the unbounded `blockedUsers` array that
 * previously lived on the user document, which bloated every user fetch and forced an O(n) scan to
 * answer "did A block B?". Here a block is a single indexed lookup, and the row count is unbounded
 * without touching the user document. Owned by auth-service; read by chat-service to reject messages.
 */
// `collection` is REQUIRED here, not cosmetic: chat-service reads this collection from the same
// database via `@Document(collection = "user_blocks")`. Without it Mongoose pluralizes the class
// name to `userblocks`, so every block auth-service wrote landed in a collection chat-service never
// read — blocked users could still DM and call their blocker. Keep both names in lockstep.
@NestSchema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'user_blocks',
})
export class UserBlock {
  @Prop({ required: true })
  blockerId: string;

  @Prop({ required: true })
  blockedId: string;
}

export const UserBlockSchema = SchemaFactory.createForClass(UserBlock);

// A user can block another at most once; also serves "did blocker block blocked?" lookups.
UserBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
// Reverse direction: "who has blocked this user?" (the blockedMe check).
UserBlockSchema.index({ blockedId: 1 });
