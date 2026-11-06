import { wrapUntrusted } from '../ai/injection-guard';
import { cutMiddle, oneLine, renderRecordBody } from './meeting-prompt';
import { MeetingRecordView, MeetingSummary } from './meeting.constants';

export const MEETING_CONTEXT_MAX_CHARS = 60_000;
const LABEL = 'Meeting record';

/** Trusted (outside the fence) instruction that goes with a record block. */
export const MEETING_INSTRUCTION =
  'The user is asking about the meeting below. Answer questions about this meeting from the record; ' +
  "say so when the record doesn't contain the answer, and never invent details.";

/** Summary part first: overview, decisions, action items (with owner), key points. */
function renderSummary(s: MeetingSummary): string {
  const lines: string[] = ['## AI summary', oneLine(s.overview)];
  if (s.decisions.length) lines.push('', '### Decisions', ...s.decisions.map((d) => `- ${oneLine(d)}`));
  if (s.actionItems.length) {
    lines.push(
      '',
      '### Action items',
      ...s.actionItems.map((a) => `- ${oneLine(a.text)}${a.assigneeName ? ` (assignee: ${oneLine(a.assigneeName)})` : ''}`),
    );
  }
  if (s.keyPoints.length) lines.push('', '### Key points', ...s.keyPoints.map((k) => `- ${oneLine(k)}`));
  if (s.fromMaterials?.length) lines.push('', '### From shared materials', ...s.fromMaterials.map((k) => `- ${oneLine(k)}`));
  return lines.join('\n');
}

/**
 * Prompt block for a question about a meeting: a short trusted instruction, then the
 * summary and the record inside an untrusted fence. The WHOLE block is at most
 * `maxChars`; when over, the record's middle is cut and the summary is kept.
 */
export function buildMeetingContextBlock(view: MeetingRecordView, maxChars = MEETING_CONTEXT_MAX_CHARS): string {
  const head = `${MEETING_INSTRUCTION}\n\n`;
  const summary = view.summary?.overview?.trim() ? renderSummary(view.summary) : '';
  const record = renderRecordBody(view);
  const fenceOverhead = wrapUntrusted(LABEL, 'x').length - 1;
  const room = Math.max(0, maxChars - head.length - fenceOverhead);
  // Summary is always kept (up to half the room); the record gets the rest.
  const summaryPart = summary ? cutMiddle(summary, Math.floor(room / 2)) : '';
  let budget = room - (summaryPart ? summaryPart.length + 2 : 0);
  for (let i = 0; i < 20; i++) {
    const body = (summaryPart ? `${summaryPart}\n\n` : '') + cutMiddle(record, Math.max(budget, 0));
    const out = head + wrapUntrusted(LABEL, body);
    if (out.length <= maxChars) return out;
    budget -= out.length - maxChars;
  }
  return (head + wrapUntrusted(LABEL, '[…]')).slice(0, maxChars);
}
