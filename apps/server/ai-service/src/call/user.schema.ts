import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

/**
 * Read-only mirror of the `users` collection (owned by auth-service, shared
 * `platform` DB). ai-service only reads `_id` + `displayName` to resolve the
 * human names behind the userId-only transcript/participant data emitted by
 * chat-service. Collection name is Mongoose's default pluralization of `User`.
 */
@Schema({ collection: 'users', timestamps: false })
export class User {
  @Prop()
  displayName: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
