/**
 * "Ask the IdP to authenticate again on the next SSO" — one device-wide flag.
 *
 * Signing out of PON does not end the company IdP's own session (ending it would
 * sign the person out of every other company app), so its cookie survives and
 * "Sign in with SSO" would silently re-enter the previous person's account. A
 * user-initiated sign-out sets this flag; the SSO button then adds `reauth=1`
 * (auth-service sends `prompt=login`) until an SSO sign-in succeeds.
 *
 * In localStorage because it must survive closing the tab. It holds no secret,
 * only "someone signed out here". A blocked storage just means a silent SSO, as
 * it was before this flag existed. Mirror: `sso_reauth_flag.dart`.
 */
const STORAGE_KEY = 'pon-sso-reauth'

export function markSsoReauth(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* storage blocked: see above */
  }
}

export function clearSsoReauth(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage blocked: see above */
  }
}

export function isSsoReauthDue(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Follows a sign-out or sign-in in another tab, so a login page left open there
 * never offers a stale link. `storage` only fires in the OTHER tabs, which is
 * enough: this tab leaves the login page right after changing the flag.
 */
export function subscribeSsoReauth(onChange: () => void): () => void {
  const listener = (event: StorageEvent) => {
    // key === null: the whole storage was cleared.
    if (event.key === STORAGE_KEY || event.key === null) onChange()
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
