import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'SYSTEM'
  | 'PASSWORD_SETUP'
  | 'PHONE_SETUP';

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  recipientId: string;

  @Prop({ required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  body: string;

  /** The user who triggered this notification (e.g. the person who sent the friend request). */
  @Prop()
  actorId?: string;

  @Prop()
  actorName?: string;

  @Prop()
  actorAvatarUrl?: string;

  /** Optional entity linked to the notification (e.g. friendship id). */
  @Prop()
  relatedEntityId?: string;

  /** Set when the user reads this notification. Null = unread. */
  @Prop({ default: null, type: Date })
  readAt: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
// Compound index: list a recipient's notifications ordered by newest.
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
