import { Injectable, Logger } from '@nestjs/common';
import { AiRequestPayload } from '../ai/ai.types';
import { buildMeetingContextBlock } from './meeting-context';
import { MeetingRecordClient } from './meeting-record.client';

/** Trusted blocks for the two failure modes — neither carries meeting content. */
export const MEETING_NO_ACCESS_BLOCK =
  "The requester has no access to this meeting's record; do not reveal or guess its content.";
export const MEETING_UNAVAILABLE_BLOCK = 'The meeting record is temporarily unavailable.';

/** Loads the record of the meeting an AI request is about, AS the asking user. */
@Injectable()
export class MeetingContextService {
  private readonly logger = new Logger(MeetingContextService.name);

  constructor(private readonly records: MeetingRecordClient) {}

  /** Prompt block for the request, or null when it is not about a meeting. */
  async blockFor(payload: AiRequestPayload, conversationMeetingId?: string | null): Promise<string | null> {
    const meetingId = payload.meetingId || conversationMeetingId;
    if (!meetingId) return null;
    try {
      const view = await this.records.fetch(meetingId, payload.userId);
      return view ? buildMeetingContextBlock(view) : MEETING_NO_ACCESS_BLOCK;
    } catch (err) {
      this.logger.warn(`Meeting record fetch failed for ${meetingId}: ${(err as Error).message}`);
      return MEETING_UNAVAILABLE_BLOCK;
    }
  }
}
