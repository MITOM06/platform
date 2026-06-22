import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CallSessionDocument = HydratedDocument<CallSession>;

/**
 * One participant of a group call. chat-service appends entries on join and
 * sets `leftAt` on leave. ai-service only READS this for the summary header
 * (distinct attendee display names).
 */
@Schema({ _id: false })
export class CallParticipant {
  @Prop()
  userId: string;

  @Prop()
  displayName: string;

  @Prop({ type: Date })
  joinedAt: Date;

  @Prop({ type: Date, default: null })
  leftAt: Date | null;
}

export const CallParticipantSchema = SchemaFactory.createForClass(CallParticipant);

/**
 * Read-only mirror of the `call_sessions` collection (Track A contract §1).
 * chat-service is the sole writer/owner; ai-service only reads a session by
 * `callId` to derive attendees + duration when producing a meeting summary.
 */
@Schema({ collection: 'call_sessions', timestamps: false })
export class CallSession {
  @Prop({ required: true, index: true })
  callId: string;

  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop()
  startedBy: string;

  @Prop()
  startedByName: string;

  @Prop({ type: Date })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;

  @Prop()
  media: string; // 'audio' | 'video'

  @Prop({ default: false })
  aiNotetaker: boolean;

  @Prop({ type: [CallParticipantSchema], default: [] })
  participants: CallParticipant[];

  @Prop({ type: String, default: null })
  summaryMessageId: string | null;
}

export const CallSessionSchema = SchemaFactory.createForClass(CallSession);
