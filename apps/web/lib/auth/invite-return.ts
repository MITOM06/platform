/**
 * A Google sign-in started from an invitation page comes back through
 * /oauth-callback, and the auth-service only knows the invite *flow* id there —
 * never the invitation token. So the tab remembers which invitation it left
 * from: a cancelled or refused Google sign-in, the wrong Google account, or an
 * expired round trip returns to that page (`/invite/<token>?reason=CODE`) to
 * try again, instead of the login page, where an invite-only workspace offers
 * no way back in.
 *
 * Same tab only (sessionStorage), consumed once, and dropped after the
 * server-side invite flow's 10 minutes.
 */
const KEY = 'pon:auth:invite-return'
const MAX_AGE_MS = 10 * 60 * 1000

/** Google sign-in outcomes worth retrying from the invitation page. */
export const INVITE_RETRY_NOTICES = [
  'SOCIAL_LOGIN_CANCELLED',
  'SOCIAL_LOGIN_FAILED',
  // Signed in with another Google account than the invited one: pick again.
  'INVITATION_EMAIL_MISMATCH',
  // The round trip took over 10 minutes (or was already used): start again.
  'INVITE_GOOGLE_FLOW_EXPIRED',
] as const
export type InviteRetryNotice = (typeof INVITE_RETRY_NOTICES)[number]

export function isInviteRetryNotice(value: unknown): value is InviteRetryNotice {
  return typeof value === 'string' && (INVITE_RETRY_NOTICES as readonly string[]).includes(value)
}

/** Called right before leaving the invitation page for Google. */
export function rememberInviteReturn(token: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }))
  } catch {
    // Storage blocked — a failed sign-in falls back to the login page.
  }
}

/** A sign-in that did not start from an invitation (or that succeeded). */
export function forgetInviteReturn(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing stored.
  }
}

/**
 * Where a failed Google sign-in goes back to: the remembered invitation page
 * for a retryable code, otherwise null (→ the login page). Always consumes
 * what was remembered.
 */
export function inviteReturnPath(error: string, now = Date.now()): string | null {
  let saved: { token?: unknown; at?: unknown } | null = null
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    saved = raw ? (JSON.parse(raw) as { token?: unknown; at?: unknown }) : null
  } catch {
    return null
  }
  if (
    !isInviteRetryNotice(error) ||
    typeof saved?.token !== 'string' ||
    !saved.token ||
    typeof saved.at !== 'number' ||
    now - saved.at > MAX_AGE_MS
  ) {
    return null
  }
  return `/invite/${encodeURIComponent(saved.token)}?reason=${error}`
}
