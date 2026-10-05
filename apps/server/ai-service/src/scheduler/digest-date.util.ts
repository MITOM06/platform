import { startOfDayIn, wallClockIn, wallClockToUtc, ymdIn } from '../common/time-zone';

/**
 * Date helpers for the daily-digest cron (TASK-11), evaluated in the workspace
 * time zone (`AI_TIMEZONE`). One deployment = one company = one zone. They used
 * container-local time, which is UTC in production: the digest fired at the
 * configured hour UTC and summarized a UTC day. Pure functions so the
 * idempotency key and window math are unit-testable without a running clock.
 */

/** `YYYY-MM-DD` of the day `d` falls on in `timeZone`. */
export function localYmd(d: Date, timeZone: string): string {
  return ymdIn(d, timeZone);
}

/** The hour (0–23) the wall clock shows in `timeZone` at `now`. */
export function localHour(now: Date, timeZone: string): number {
  return wallClockIn(now, timeZone).hour;
}

/** Midnight (00:00 in `timeZone`) of the day `now` falls in. */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  return startOfDayIn(now, timeZone);
}

/**
 * The [start, end) window for "yesterday" relative to `now` in `timeZone`, plus
 * its `YYYY-MM-DD` digestDate key: `start` = yesterday 00:00 local, `end` =
 * today 00:00 local (23 or 25 h long across a DST change).
 */
export function yesterdayWindow(
  now: Date,
  timeZone: string,
): { start: Date; end: Date; digestDate: string } {
  const today = wallClockIn(now, timeZone);
  const midnight = { ...today, hour: 0, minute: 0, second: 0 };
  const end = wallClockToUtc(midnight, timeZone);
  const start = wallClockToUtc({ ...midnight, day: today.day - 1 }, timeZone);
  return { start, end, digestDate: ymdIn(start, timeZone) };
}
