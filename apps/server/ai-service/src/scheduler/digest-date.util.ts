/**
 * Local-time date helpers for the daily-digest cron (TASK-11). Single-tenant
 * deployment ⇒ "local" is the server/workspace timezone (per-user timezone is a
 * documented follow-up). Extracted as pure functions so the idempotency-key and
 * window math are unit-testable without a running clock.
 */

/** `YYYY-MM-DD` in LOCAL time for the given date. */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local midnight (00:00:00.000) of the day `now` falls in. */
export function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * The [start, end) window for "yesterday" relative to `now`, plus its
 * `YYYY-MM-DD` digestDate key. `start` = yesterday 00:00 local, `end` = today
 * 00:00 local.
 */
export function yesterdayWindow(now: Date): {
  start: Date;
  end: Date;
  digestDate: string;
} {
  const end = startOfLocalDay(now);
  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  return { start, end, digestDate: localYmd(start) };
}
