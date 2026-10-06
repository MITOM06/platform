/**
 * Canonical form of an email address for lookups and for every Redis key derived from one
 * (lockout, failed attempts, OTP attempts / cooldown / rate limit). Invitations store emails in
 * this form, so `Bob@Acme.com` and `bob@acme.com` must resolve to the same account and share
 * the same brute-force counters.
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/** Escape a string for use inside a RegExp (anchored exact-match lookups). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
