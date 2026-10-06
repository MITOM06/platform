import { clip } from '../internal/tool-errors';

/**
 * Compact, model-friendly summaries of Google API results. The previous tools
 * returned only counts ("3 upcoming event(s)"), so the assistant could not
 * answer "what's on my calendar?" or "what did Alice send me?".
 */

export interface CalendarEventLike {
  id?: string;
  summary?: string;
  status?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: unknown[];
}

export interface ThreadSummary {
  id: string;
  messageCount: number;
  from?: string;
  subject?: string;
  date?: string;
  snippet?: string;
}

function when(t?: { dateTime?: string; date?: string }): string {
  if (t?.dateTime) return t.dateTime;
  if (t?.date) return `${t.date} (all day)`;
  return '?';
}

export function summarizeEvents(events: CalendarEventLike[]): string {
  if (!events.length) return 'No events found in that time range.';
  const lines = events.map((e, i) => {
    const parts = [`${i + 1}. ${clip(e.summary || '(no title)', 120)}`, `${when(e.start)} → ${when(e.end)}`];
    if (e.location) parts.push(`location: ${clip(e.location, 80)}`);
    if (Array.isArray(e.attendees) && e.attendees.length) parts.push(`attendees: ${e.attendees.length}`);
    if (e.status && e.status !== 'confirmed') parts.push(`status: ${e.status}`);
    if (e.id) parts.push(`id: ${e.id}`);
    return parts.join(' · ');
  });
  return [`${events.length} event(s):`, ...lines].join('\n');
}

export function summarizeThreads(query: string, threads: ThreadSummary[], totalEstimate?: number): string {
  if (!threads.length) return `No email threads match "${clip(query, 80)}".`;
  const more =
    typeof totalEstimate === 'number' && totalEstimate > threads.length
      ? ` (showing ${threads.length} of about ${totalEstimate})`
      : '';
  const lines = threads.map((t, i) => {
    const head = [
      `${i + 1}. ${clip(t.subject || '(no subject)', 150)}`,
      t.from ? `from: ${clip(t.from, 120)}` : null,
      t.date ? `date: ${clip(t.date, 60)}` : null,
      `messages: ${t.messageCount}`,
      `id: ${t.id}`,
    ].filter(Boolean);
    const snippet = t.snippet ? `\n   ${clip(t.snippet, 200)}` : '';
    return `${head.join(' · ')}${snippet}`;
  });
  return [`Found ${threads.length} thread(s) for "${clip(query, 80)}"${more}:`, ...lines].join('\n');
}

/** Gmail thread (format=metadata) → summary of its latest message. */
export function threadSummary(thread: {
  id?: string;
  snippet?: string;
  messages?: Array<{ snippet?: string; payload?: { headers?: Array<{ name?: string; value?: string }> } }>;
}): ThreadSummary {
  const messages = thread.messages ?? [];
  const header = (msg: (typeof messages)[number] | undefined, name: string) =>
    msg?.payload?.headers?.find((h) => h.name?.toLowerCase() === name)?.value;
  const first = messages[0];
  const last = messages[messages.length - 1];
  return {
    id: thread.id ?? '',
    messageCount: messages.length || 1,
    from: header(last, 'from') ?? header(first, 'from'),
    subject: header(first, 'subject') ?? header(last, 'subject'),
    date: header(last, 'date'),
    snippet: last?.snippet ?? thread.snippet,
  };
}

/** A short machine reason from a Google error body (`insufficientPermissions`, `NOT_FOUND`), never the body. */
export function googleErrorReason(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as {
      error?: { status?: unknown; errors?: Array<{ reason?: unknown }> } | string;
    };
    const err = parsed?.error;
    if (typeof err === 'string') return /^[a-z_]{1,64}$/.test(err) ? err : undefined;
    const reason = err?.errors?.[0]?.reason;
    if (typeof reason === 'string' && /^[A-Za-z_]{1,64}$/.test(reason)) return reason;
    if (typeof err?.status === 'string' && /^[A-Z_]{1,64}$/.test(err.status)) return err.status;
  } catch {
    // not JSON
  }
  return undefined;
}
