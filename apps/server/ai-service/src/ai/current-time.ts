/**
 * The model has no clock. Without "now" in the prompt it resolved "in 2 minutes"
 * or "8pm tonight" against its training-era guess (2025) and every
 * create_reminder call was rejected as "in the past" — reminders never worked.
 * This block goes in the per-request (uncached) system part.
 */
export function currentTimeContext(now: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  // "GMT+07:00" → "+07:00". UTC prints as "GMT" or "GMT+00:00" depending on ICU.
  const offset = parts.timeZoneName === 'GMT' ? '+00:00' : parts.timeZoneName.replace('GMT', '');
  const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
  return (
    `Current date and time: ${parts.weekday}, ${iso} (time zone ${timeZone}).\n` +
    'Resolve relative times ("in 2 minutes", "tonight", "next Monday") from this, ' +
    'and pass tools absolute ISO 8601 datetimes with the offset above.'
  );
}
