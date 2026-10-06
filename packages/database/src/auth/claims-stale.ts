/**
 * "Claims-stale" access tokens (role / department / permission changes take
 * effect without a re-login).
 *
 * When a user's RBAC claims change, auth-service writes
 * `HSET sess:{sid} claimsAt <unix seconds>` on every live session of that user
 * (TTL kept) and publishes {@link CLAIMS_CHANGED_CHANNEL}. Every access-token
 * validator then rejects a token minted before that instant with
 * `401 { code: "TOKEN_CLAIMS_STALE" }`; the client refreshes (the session itself
 * is still valid, `POST /auth/refresh` keeps working) and gets a token carrying
 * the fresh claims.
 */

/** Redis Pub/Sub channel. Payload: `{"userId":"<id>"}`. */
export const CLAIMS_CHANGED_CHANNEL = 'auth:claims-changed';

/** `sess:{sid}` hash field holding the claims-change instant (unix seconds). */
export const SESSION_CLAIMS_AT_FIELD = 'claimsAt';

/** 401 error code for an access token minted before the session's `claimsAt`. */
export const TOKEN_CLAIMS_STALE = 'TOKEN_CLAIMS_STALE';

/** `claimsAt` as stored on the session hash → unix seconds, or null when absent/garbled. */
export function parseClaimsAt(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const at = Number(raw);
  return Number.isFinite(at) ? at : null;
}

/**
 * True when an access token issued at `iat` (unix seconds) predates the
 * session's `claimsAt` — strict `<`, so a token minted in the same second as
 * the change (e.g. by the refresh that follows it) is accepted. No `claimsAt`
 * = no check. A token without a numeric `iat` cannot prove it is fresh, so it
 * is stale once `claimsAt` exists (auth-service always sets `iat`).
 */
export function isTokenClaimsStale(
  iat: number | undefined | null,
  claimsAtRaw: unknown,
): boolean {
  const claimsAt = parseClaimsAt(claimsAtRaw);
  if (claimsAt === null) return false;
  if (typeof iat !== 'number' || !Number.isFinite(iat)) return true;
  return iat < claimsAt;
}
