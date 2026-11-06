import { Injectable, Logger } from '@nestjs/common';
import { wrapUntrusted } from '../ai/injection-guard';
import { MeetingRecordClient } from '../meeting/meeting-record.client';
import { cutMiddle, renderRecordBody } from '../meeting/meeting-prompt';
import { hasSummaryContent, renderSummary } from '../meeting/meeting-context';
import { MeetingRecordView } from '../meeting/meeting.constants';
import { MEETING_NOT_FOUND, MEETING_UNAVAILABLE } from './list-my-meetings.tool';
import { ToolContext, ToolDefinition } from './tool.interface';

export const MEETING_TOOL_MAX_CHARS = 30_000;
const MEETING_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Lower-cased words of 3+ letters/digits (Unicode-aware, so Vietnamese diacritics survive). */
export function keywordsOf(question: string): string[] {
  const words = question.normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return [...new Set(words.filter((w) => [...w].length >= 3))];
}

function renderBody(view: MeetingRecordView, keywords: string[]): string {
  const lines = renderRecordBody(view).split('\n');
  if (!keywords.length) return lines.join('\n');
  // Header (up to the first blank line) is always kept; the rest only when a line mentions a keyword.
  const blank = lines.indexOf('');
  const header = blank === -1 ? lines : lines.slice(0, blank);
  const rest = blank === -1 ? [] : lines.slice(blank + 1);
  const hits = rest.filter((l) => !l.startsWith('## ') && keywords.some((k) => l.normalize('NFC').toLowerCase().includes(k)));
  return [...header, '', ...(hits.length ? hits : ['(No record lines matched the question.)'])].join('\n');
}

@Injectable()
export class GetMeetingRecordTool {
  static readonly definition: ToolDefinition = {
    name: 'get_meeting_record',
    description:
      "Get the AI summary and the record (speech transcript, shared-file text, in-meeting chat, shared note) of one of the user's finished meetings. " +
      'If you do not know the meetingId, call list_my_meetings first. ' +
      'Pass `question` (a few keywords from what the user asks) to receive only the matching record lines instead of the whole record.',
    input_schema: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'The meetingId returned by list_my_meetings' },
        question: { type: 'string', description: 'Optional: what the user wants to know; only matching record lines are returned' },
      },
      required: ['meetingId'],
    },
  };

  private readonly logger = new Logger(GetMeetingRecordTool.name);

  constructor(private readonly client: MeetingRecordClient) {}

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    if (ctx.directAi !== true) return MEETING_NOT_FOUND;
    ctx.meetingContentRead = true;
    const id = input['meetingId'];
    if (typeof id !== 'string' || !MEETING_ID_RE.test(id)) return MEETING_NOT_FOUND;
    const question = typeof input['question'] === 'string' ? input['question'] : '';
    const keywords = keywordsOf(question);

    let view: MeetingRecordView | null;
    try {
      view = await this.client.fetch(id, ctx.userId);
    } catch (err) {
      this.logger.warn(`get_meeting_record failed: ${(err as Error).message}`);
      return MEETING_UNAVAILABLE;
    }
    if (!view) return MEETING_NOT_FOUND;

    const summary = hasSummaryContent(view.summary) ? renderSummary(view.summary) : '';
    const body = renderBody(view, keywords);
    const text = summary ? `${summary}\n\n${body}` : body;
    return wrapUntrusted('Meeting record', cutMiddle(text, MEETING_TOOL_MAX_CHARS));
  }
}
