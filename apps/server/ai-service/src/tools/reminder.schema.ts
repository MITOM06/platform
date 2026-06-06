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

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const ReminderSchema = SchemaFactory.createForClass(Reminder);
