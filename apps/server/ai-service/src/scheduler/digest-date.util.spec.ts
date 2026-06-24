import { localYmd, startOfLocalDay, yesterdayWindow } from './digest-date.util';

describe('digest-date.util (TASK-11)', () => {
  it('localYmd formats local date as YYYY-MM-DD with zero padding', () => {
    expect(localYmd(new Date(2026, 0, 5, 13, 30))).toBe('2026-01-05');
    expect(localYmd(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('startOfLocalDay zeroes the time component', () => {
    const s = startOfLocalDay(new Date(2026, 5, 23, 8, 45, 12, 999));
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
    expect(s.getMilliseconds()).toBe(0);
    expect(localYmd(s)).toBe('2026-06-23');
  });

  it('yesterdayWindow spans yesterday-00:00 (incl) to today-00:00 (excl)', () => {
    const now = new Date(2026, 5, 23, 8, 0, 0); // 2026-06-23 08:00 local
    const { start, end, digestDate } = yesterdayWindow(now);
    expect(digestDate).toBe('2026-06-22');
    expect(localYmd(start)).toBe('2026-06-22');
    expect(start.getHours()).toBe(0);
    expect(localYmd(end)).toBe('2026-06-23');
    expect(end.getHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('handles month/year boundaries (Jan 1 ⇒ Dec 31 prior year)', () => {
    const { digestDate } = yesterdayWindow(new Date(2026, 0, 1, 9, 0, 0));
    expect(digestDate).toBe('2025-12-31');
  });
});
