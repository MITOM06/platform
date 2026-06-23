import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FeedbackDocument = HydratedDocument<Feedback>;

/**
 * Read model over the SHARED `ai_feedback` collection (owned/written by
 * chat-service `AiFeedbackService`; shape confirmed from `AiFeedback.java`).
 * ai-service reads it ONLY for the dashboard's 👎 rate + worst-rated answers
 * (TASK-13) and NEVER writes it. chat-service deletes the doc on "none", so only
 * `up`/`down` rows persist.
 */
@Schema({ collection: 'ai_feedback' })
export class Feedback {
  @Prop()
  messageId?: string;

  @Prop()
  conversationId?: string;

  @Prop()
  userId?: string;

  /** 'up' | 'down' */
  @Prop()
  rating?: string;

  @Prop()
  comment?: string;

  @Prop()
  createdAt?: Date;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
