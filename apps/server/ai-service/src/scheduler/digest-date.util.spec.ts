import { localHour, localYmd, startOfLocalDay, yesterdayWindow } from './digest-date.util';

const HCM = 'Asia/Ho_Chi_Minh'; // UTC+07:00, no DST

describe('digest-date.util (TASK-11) — workspace time zone, not container time', () => {
  it('localYmd formats the date in the given zone with zero padding', () => {
    // 2026-01-04T20:30Z is already Jan 5 in Ho Chi Minh City.
    expect(localYmd(new Date('2026-01-04T20:30:00Z'), HCM)).toBe('2026-01-05');
    expect(localYmd(new Date('2026-01-04T20:30:00Z'), 'UTC')).toBe('2026-01-04');
    expect(localYmd(new Date('2026-12-31T16:59:00Z'), HCM)).toBe('2026-12-31');
  });

  it('localHour is the wall-clock hour in the zone (08:00 +07 = 01:00 UTC)', () => {
    const now = new Date('2026-06-23T01:00:00Z');
    expect(localHour(now, HCM)).toBe(8);
    expect(localHour(now, 'UTC')).toBe(1);
  });

  it('startOfLocalDay is local midnight expressed in UTC', () => {
    const s = startOfLocalDay(new Date('2026-06-23T01:45:12.999Z'), HCM);
    expect(s.toISOString()).toBe('2026-06-22T17:00:00.000Z');
  });

  it('yesterdayWindow spans yesterday-00:00 (incl) to today-00:00 (excl) in the zone', () => {
    const now = new Date('2026-06-23T01:00:00Z'); // 2026-06-23 08:00 in HCM
    const { start, end, digestDate } = yesterdayWindow(now, HCM);
    expect(digestDate).toBe('2026-06-22');
    expect(start.toISOString()).toBe('2026-06-21T17:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-22T17:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('a UTC container no longer shifts the day: 06:30 local on the 23rd digests the 22nd', () => {
    // 2026-06-22T23:30Z — still the 22nd in UTC, already the 23rd in HCM.
    const { digestDate } = yesterdayWindow(new Date('2026-06-22T23:30:00Z'), HCM);
    expect(digestDate).toBe('2026-06-22');
  });

  it('handles month/year boundaries (Jan 1 ⇒ Dec 31 prior year)', () => {
    const { digestDate, start } = yesterdayWindow(new Date('2026-01-01T02:00:00Z'), HCM);
    expect(digestDate).toBe('2025-12-31');
    expect(start.toISOString()).toBe('2025-12-30T17:00:00.000Z');
  });

  it('follows DST: the day after the spring-forward change is 23 h long', () => {
    // US DST starts 2026-03-08; on the 9th, "yesterday" (the 8th) lasted 23 h.
    const { start, end, digestDate } = yesterdayWindow(
      new Date('2026-03-09T13:00:00Z'),
      'America/New_York',
    );
    expect(digestDate).toBe('2026-03-08');
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });
});
