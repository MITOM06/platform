import { currentTimeContext } from './current-time';

describe('currentTimeContext', () => {
  const now = new Date('2026-09-30T12:45:30Z');

  it('states the local wall time with its UTC offset', () => {
    const text = currentTimeContext(now, 'Asia/Ho_Chi_Minh');
    expect(text).toContain('Wednesday, 2026-09-30T19:45:30+07:00');
    expect(text).toContain('time zone Asia/Ho_Chi_Minh');
  });

  it('uses +00:00 for UTC', () => {
    expect(currentTimeContext(now, 'UTC')).toContain('2026-09-30T12:45:30+00:00');
  });

  it('rolls the date over across midnight in the target zone', () => {
    const late = new Date('2026-09-30T18:30:00Z'); // 01:30 next day in Vietnam
    expect(currentTimeContext(late, 'Asia/Ho_Chi_Minh')).toContain('Thursday, 2026-10-01T01:30:00+07:00');
  });

  it('produces an ISO string the reminder tool can parse back to the same instant', () => {
    const iso = currentTimeContext(now, 'Asia/Ho_Chi_Minh').match(/\d{4}-\d\d-\d\dT[\d:]+[+-]\d\d:\d\d/)![0];
    expect(new Date(iso).getTime()).toBe(now.getTime());
  });
});
