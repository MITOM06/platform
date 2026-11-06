import { MeetingActionItem, MeetingRecordView, MeetingSummary } from './meeting.constants';

export const MEETING_PROMPT_MAX_CHARS = 120_000;
const CUT_MARKER = '\n[…]\n';
const GENERIC_SPEAKER = 'Speaker';

export const MEETING_SYSTEM_PROMPT =
  'You are PON AI, summarizing a finished meeting for its participants. ' +
  'You get the meeting record: speech transcript lines ("[SPEECH] Speaker: text"), text extracted from ' +
  'shared files/screens ("[FILE]"/"[SCREEN]"), the in-meeting chat, and the shared note. ' +
  'Respond with STRICT JSON only (no prose, no markdown, no code fences) exactly matching: ' +
  '{ "overview": string, "keyPoints": string[], "decisions": string[], ' +
  '"actionItems": [{ "text": string, "assigneeName": string | null }], ' +
  '"fromMaterials": string[], "language": string }. ' +
  '"overview" is 1-3 sentences. "decisions" lists what was decided. "actionItems" are concrete follow-ups; ' +
  'assigneeName is the person named as owner or null. "fromMaterials" summarizes what was learned from [FILE]/[SCREEN] ' +
  'segments; use [] when there are none. Use [] for any list with no items. ' +
  'Write ALL text in the language that dominates the record, and put its ISO 639-1 code in "language". ' +
  'Never invent facts that are not in the record.';

/** Render the record as the user prompt; over `maxChars` the middle is cut (head + tail kept). */
export function renderMeetingPrompt(view: MeetingRecordView, maxChars = MEETING_PROMPT_MAX_CHARS): string {
  const m = view.meeting;
  const lines: string[] = [`Meeting: ${m.title?.trim() || m.code}`];
  if (m.hostName) lines.push(`Host: ${m.hostName}`);
  if (m.startedAt) lines.push(`Started: ${m.startedAt}`);
  if (m.endedAt) lines.push(`Ended: ${m.endedAt}`);
  const names = view.attendees.map((a) => a.displayName).filter(Boolean);
  if (names.length) lines.push(`Attendees: ${names.join(', ')}`);

  if (view.records.length) {
    lines.push('', '## Record');
    for (const r of view.records) {
      lines.push(`[${r.kind}] ${r.displayName?.trim() || GENERIC_SPEAKER}: ${r.text}`);
    }
  }
  if (view.chat.length) {
    lines.push('', '## Chat');
    for (const c of view.chat) lines.push(`${c.senderName}: ${c.content}`);
  }
  if (view.sharedNote?.trim()) lines.push('', '## Shared note', view.sharedNote.trim());

  const text = lines.join('\n');
  if (text.length <= maxChars) return text;
  const keep = maxChars - CUT_MARKER.length;
  const head = Math.ceil(keep / 2);
  return text.slice(0, head) + CUT_MARKER + text.slice(text.length - (keep - head));
}

function strings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
}

function actionItems(v: unknown): MeetingActionItem[] {
  if (!Array.isArray(v)) return [];
  const out: MeetingActionItem[] = [];
  for (const x of v) {
    if (typeof x === 'string') {
      if (x.trim()) out.push({ text: x.trim(), assigneeName: null });
    } else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      const text = typeof o.text === 'string' ? o.text.trim() : '';
      if (!text) continue;
      const a = typeof o.assigneeName === 'string' ? o.assigneeName.trim() : '';
      out.push({ text, assigneeName: a || null });
    }
  }
  return out;
}

/** Parse the model output into a normalised summary; null when unusable. */
export function parseMeetingSummary(raw: string): MeetingSummary | null {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(s);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const o = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
    const overview = typeof o.overview === 'string' ? o.overview.trim() : '';
    if (!overview) return null;
    return {
      overview,
      keyPoints: strings(o.keyPoints),
      decisions: strings(o.decisions),
      actionItems: actionItems(o.actionItems),
      fromMaterials: strings(o.fromMaterials),
      language: typeof o.language === 'string' ? o.language.trim() : '',
    };
  } catch {
    return null;
  }
}
