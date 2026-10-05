/**
 * Wall-clock helpers for the deployment time zone (`AI_TIMEZONE`).
 *
 * Containers run in UTC, so `Date#getHours()` and `new Date('2026-09-30T20:00')`
 * are UTC there: the daily digest fired at the UTC hour over a UTC day, and a
 * reminder given without an offset fired 7 h late for a +07:00 company. Every
 * helper takes the zone explicitly and is pure (Intl-based, no tz database).
 */

export interface WallClock {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** `timeZone` if it is a valid IANA zone, else `fallback`. */
export function safeTimeZone(timeZone: string | null | undefined, fallback = 'UTC'): string {
  if (!timeZone) return fallback;
  try {
    formatterFor(timeZone);
    return timeZone;
  } catch {
    return fallback;
  }
}

/** The wall-clock reading of `date` in `timeZone`. */
export function wallClockIn(date: Date, timeZone: string): WallClock {
  const parts: Record<string, string> = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset of `timeZone` at `date` in ms (wall clock minus UTC; +07:00 → 25 200 000). */
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const w = wallClockIn(date, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The UTC instant at which the wall clock in `timeZone` shows `w`. Out-of-range
 * fields normalize like `Date.UTC` (day 0 = last day of the previous month).
 */
export function wallClockToUtc(w: WallClock, timeZone: string, ms = 0): Date {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second, ms);
  const first = zoneOffsetMs(new Date(guess), timeZone);
  let instant = guess - first;
  // Re-check at the candidate instant: across a DST change the offset differs.
  const second = zoneOffsetMs(new Date(instant), timeZone);
  if (second !== first) instant = guess - second;
  return new Date(instant);
}

/** `YYYY-MM-DD` of the calendar day `date` falls on in `timeZone`. */
export function ymdIn(date: Date, timeZone: string): string {
  const w = wallClockIn(date, timeZone);
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

/** Local midnight (00:00 in `timeZone`) of the day `date` falls on, as a UTC instant. */
export function startOfDayIn(date: Date, timeZone: string): Date {
  const w = wallClockIn(date, timeZone);
  return wallClockToUtc({ ...w, hour: 0, minute: 0, second: 0 }, timeZone);
}

/** `2026-09-30T20:00:00+07:00` — `date` as an ISO string in `timeZone`'s offset. */
export function isoInZone(date: Date, timeZone: string): string {
  const w = wallClockIn(date, timeZone);
  const offsetMin = Math.round(zoneOffsetMs(date, timeZone) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/**
 * Parse an ISO-8601 date/time. With an explicit offset (`Z`, `+07:00`, `+0700`,
 * `+07`) the instant is absolute; WITHOUT one (`2026-09-30T20:00`,
 * `2026-09-30 20:00:00`) it is a wall-clock time in `timeZone` — never UTC, which
 * is what `new Date()` assumes on a UTC container. Date-only = local midnight.
 * Returns null for anything that is not a real ISO date/time.
 */
export function parseDateTimeInZone(input: string, timeZone: string): Date | null {
  const m = ISO_RE.exec((input ?? '').trim());
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', frac = '', offset] = m;
  const fields: WallClock = {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi),
    second: Number(s),
  };
  const ms = frac ? Math.round(Number(`0.${frac}`) * 1000) : 0;
  if (fields.month < 1 || fields.month > 12 || fields.day < 1 || fields.day > 31) return null;
  if (fields.hour > 23 || fields.minute > 59 || fields.second > 59) return null;
  // Reject impossible calendar dates (2026-02-30) instead of rolling them over.
  const probe = new Date(Date.UTC(fields.year, fields.month - 1, fields.day));
  if (probe.getUTCMonth() !== fields.month - 1 || probe.getUTCDate() !== fields.day) return null;

  if (!offset) return wallClockToUtc(fields, timeZone, ms);
  const utc = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second,
    ms,
  );
  if (offset.toUpperCase() === 'Z') return new Date(utc);
  const om = /^([+-])(\d{2}):?(\d{2})?$/.exec(offset);
  if (!om) return null;
  const minutes = Number(om[2]) * 60 + Number(om[3] ?? '0');
  if (Number(om[2]) > 23 || Number(om[3] ?? '0') > 59) return null;
  return new Date(utc - (om[1] === '-' ? -1 : 1) * minutes * 60000);
}
