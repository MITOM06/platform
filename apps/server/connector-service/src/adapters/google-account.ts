/**
 * The Google account behind a Gmail / Calendar grant, read with the scopes the
 * connection already holds (no extra consent): Gmail's profile address, or the
 * id of the primary calendar, which is the account's email. Stored as the
 * connection's `accountLabel`, so a disconnect can tell whether another
 * connection rides the same Google grant (GoogleRestAdapter.revoke).
 */
const ACCOUNT_SOURCE: Readonly<Record<string, { url: string; field: string }>> = {
  gmail: { url: 'https://gmail.googleapis.com/gmail/v1/users/me/profile', field: 'emailAddress' },
  calendar: { url: 'https://www.googleapis.com/calendar/v3/calendars/primary', field: 'id' },
};

const LOOKUP_TIMEOUT_MS = 5_000;

/** Lower-cased account email; `undefined` for other providers or on any failure (never throws). */
export async function googleAccountEmail(
  provider: string,
  accessToken: string | undefined,
): Promise<string | undefined> {
  const source = ACCOUNT_SOURCE[provider];
  if (!source || !accessToken) return undefined;
  try {
    const res = await fetch(source.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const value = ((await res.json()) as Record<string, unknown>)[source.field];
    return typeof value === 'string' && value.includes('@') ? value.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}
