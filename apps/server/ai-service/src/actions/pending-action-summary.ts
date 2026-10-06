import { providerOf } from '../tools/tool-names';
import { normalizedToolName } from './pending-action-policy';
import { PendingActionSummary } from './pending-action.types';

/** Per-field caps (characters) — a summary is a card line, not a document. */
const MAX_RECIPIENTS = 200;
const MAX_SUBJECT = 150;
const MAX_TITLE = 150;
const MAX_TIME = 64;
const MAX_TOOL = 60;

/** Email sends under any provider; `send_message`/`reply`/`forward` only mean email on Gmail. */
const EMAIL_SEND = new Set(['send_email', 'send_mail']);
const GMAIL_SEND = new Set(['send_message', 'reply', 'forward']);
const EMAIL_DRAFT = new Set(['create_draft', 'update_draft']);
const EVENT_CREATE = new Set(['create_event', 'quick_add_event']);
const EVENT_UPDATE = new Set(['update_event', 'patch_event']);
const PAGE_CREATE = new Set(['create_page', 'create_pages']);
const PAGE_UPDATE = new Set(['update_page', 'update_pages']);

/** Single-line, trimmed, length-capped; anything but a non-blank string ⇒ undefined. */
function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  // Control characters (incl. CR/LF) would break the card line.
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** RFC 3339 string, or a Google-style `{ dateTime }` / `{ date }` object. */
function cleanTime(value: unknown): string | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    return clean(v['dateTime'] ?? v['date'], MAX_TIME);
  }
  return clean(value, MAX_TIME);
}

/** `"a@x, b@y"` or `["a@x", "b@y"]` (or `[{ email }]`). */
function cleanRecipients(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const list = value
      .map((v) => (typeof v === 'string' ? v : (v as { email?: unknown } | null)?.email))
      .filter((v): v is string => typeof v === 'string');
    return clean(list.join(', '), MAX_RECIPIENTS);
  }
  return clean(value, MAX_RECIPIENTS);
}

/** Plain text of a string or a Notion rich-text value (`[{ text: { content } }]`, `{ title: [...] }`). */
function textOf(value: unknown, depth = 0): string | undefined {
  if (typeof value === 'string') return value;
  if (value == null || depth > 4) return undefined;
  if (Array.isArray(value)) {
    const parts = value.map((v) => textOf(v, depth + 1)).filter((p): p is string => !!p);
    return parts.length > 0 ? parts.join('') : undefined;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return textOf(o['plain_text'] ?? o['content'] ?? o['text'] ?? o['title'], depth + 1);
  }
  return undefined;
}

/** A page/event title: top-level keys, Notion `properties`, or the first nested page/event. */
function findTitle(input: Record<string, unknown>, depth = 0): string | undefined {
  for (const key of ['title', 'summary', 'name']) {
    const t = clean(textOf(input[key]), MAX_TITLE);
    if (t) return t;
  }
  const props = input['properties'];
  if (props && typeof props === 'object' && !Array.isArray(props)) {
    for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
      if (!/^(title|name)$/i.test(key)) continue;
      const t = clean(textOf(value), MAX_TITLE);
      if (t) return t;
    }
  }
  if (depth >= 2) return undefined;
  for (const key of ['pages', 'data', 'page', 'event']) {
    const value = input[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const t = findTitle(first as Record<string, unknown>, depth + 1);
      if (t) return t;
    }
  }
  return undefined;
}

/** "Create pages" from `mcp__notion__notion-create-pages` — the generic card label. */
export function humanizeToolName(toolName: string): string {
  const words = normalizedToolName(toolName).replace(/_+/g, ' ').trim();
  const label = clean(words, MAX_TOOL);
  if (!label) return 'Action';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Drop undefined fields so the JSON stays minimal. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Build the humanized, non-secret summary of a pending action from its tool
 * name + input. Picks only display fields (recipients, subject, title, times);
 * never the body, attendees, ids or links.
 */
export function buildActionSummary(
  toolName: string,
  input: Record<string, unknown> | null | undefined,
): PendingActionSummary {
  const args = input && typeof input === 'object' ? input : {};
  const name = normalizedToolName(toolName);
  const provider = providerOf(toolName);

  const isEmailSend = EMAIL_SEND.has(name) || (provider === 'gmail' && GMAIL_SEND.has(name));
  // A "draft" elsewhere may be a document draft — only mail-shaped ones are emails.
  const isEmailDraft = EMAIL_DRAFT.has(name) && (provider === 'gmail' || 'to' in args);
  if (isEmailSend || isEmailDraft) {
    return compact({
      kind: isEmailSend ? ('send_email' as const) : ('draft_email' as const),
      to: cleanRecipients(args['to']),
      subject: clean(args['subject'], MAX_SUBJECT),
    });
  }
  if (EVENT_CREATE.has(name) || EVENT_UPDATE.has(name)) {
    return compact({
      kind: EVENT_CREATE.has(name) ? ('create_event' as const) : ('update_event' as const),
      title: findTitle(args),
      start: cleanTime(args['start'] ?? args['startTime']),
      end: cleanTime(args['end'] ?? args['endTime']),
    });
  }
  if (PAGE_CREATE.has(name) || PAGE_UPDATE.has(name)) {
    return compact({
      kind: PAGE_CREATE.has(name) ? ('create_page' as const) : ('update_page' as const),
      title: findTitle(args),
    });
  }
  return { kind: 'generic', tool: humanizeToolName(toolName) };
}

/** An English one-liner of the summary for the follow-up prompt (model-facing only). */
export function describeSummary(summary: PendingActionSummary): string {
  const q = (s?: string) => (s ? `"${s}"` : '');
  switch (summary.kind) {
    case 'send_email':
    case 'draft_email': {
      const what = summary.kind === 'send_email' ? 'send an email' : 'save an email draft';
      const to = summary.to ? ` to ${summary.to}` : '';
      const subject = summary.subject ? ` with the subject ${q(summary.subject)}` : '';
      return `${what}${to}${subject}`;
    }
    case 'create_event':
    case 'update_event': {
      const verb = summary.kind === 'create_event' ? 'create' : 'update';
      const when = summary.start ? ` (${summary.start}${summary.end ? ` – ${summary.end}` : ''})` : '';
      return `${verb} the calendar event${summary.title ? ` ${q(summary.title)}` : ''}${when}`;
    }
    case 'create_page':
    case 'update_page': {
      const verb = summary.kind === 'create_page' ? 'create' : 'update';
      return `${verb} the page${summary.title ? ` ${q(summary.title)}` : ''}`;
    }
    default:
      return `run the action ${q(summary.tool)}`;
  }
}
