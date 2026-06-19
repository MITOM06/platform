import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReminderDocument = HydratedDocument<Reminder>;

@Schema({ collection: 'reminders' })
export class Reminder {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  remindAt: Date;

  @Prop({ default: false })
  done: boolean;

  // Set true by chat-service's ReminderSweepService once the push has been delivered,
  // so a reminder is never sent twice. Kept in sync with chat-service's Reminder model.
  @Prop({ default: false })
  notified: boolean;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const ReminderSchema = SchemaFactory.createForClass(Reminder);
