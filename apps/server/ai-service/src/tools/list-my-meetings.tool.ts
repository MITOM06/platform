import { Injectable, Logger } from '@nestjs/common';
import { wrapUntrusted } from '../ai/injection-guard';
import { MeetingRecordClient } from '../meeting/meeting-record.client';
import { oneLine } from '../meeting/meeting-prompt';
import { ToolContext, ToolDefinition } from './tool.interface';

export const MEETING_NOT_FOUND = 'Meeting not found.';
export const MEETING_UNAVAILABLE = 'Meeting records are temporarily unavailable.';

@Injectable()
export class ListMyMeetingsTool {
  static readonly definition: ToolDefinition = {
    name: 'list_my_meetings',
    description:
      "List the user's finished meetings that have a record (newest first, max 20), optionally filtered by a title keyword. " +
      'Call this FIRST whenever the user asks about a past meeting and you do not already know its meetingId, ' +
      'then pass the chosen meetingId to get_meeting_record.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Optional keyword to match in the meeting title' } },
      required: [],
    },
  };

  private readonly logger = new Logger(ListMyMeetingsTool.name);

  constructor(private readonly client: MeetingRecordClient) {}

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    if (ctx.directAi !== true) return MEETING_NOT_FOUND;
    ctx.meetingContentRead = true;
    const raw = input['query'];
    const query = typeof raw === 'string' ? oneLine(raw).slice(0, 200) : '';
    let items;
    try {
      items = await this.client.listMine(ctx.userId, query || undefined);
    } catch (err) {
      this.logger.warn(`list_my_meetings failed: ${(err as Error).message}`);
      return MEETING_UNAVAILABLE;
    }
    if (!items?.length) return 'No meetings found.';
    const rows = items.map((m) => ({
      meetingId: m.id,
      title: oneLine(m.title) || oneLine(m.code),
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      hasSummary: m.summaryState === 'DONE',
    }));
    return wrapUntrusted('Meetings', JSON.stringify(rows));
  }
}
