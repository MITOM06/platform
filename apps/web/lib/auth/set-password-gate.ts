import type { AuthUser } from '@/lib/store/auth.store'

/**
 * Onboarding gate for members who joined with "Continue with Google": the
 * server flags the new account `mustSetPassword` and the member must create a
 * PON password before using the app. It is an onboarding step, not a security
 * boundary (the server enforces nothing beyond the flag), so it lives here in
 * the client and is mirrored on mobile (`route_guard.dart`).
 */
export const SET_PASSWORD_PATH = '/set-password'

/** Where the app starts once the gate is cleared (`/` → `/conversations`). */
export const APP_HOME_PATH = '/'

/** True only when the server explicitly flagged the account — absent means false. */
export function mustSetPassword(user: Pick<AuthUser, 'mustSetPassword'> | null | undefined): boolean {
  return user?.mustSetPassword === true
}

export function isSetPasswordPath(pathname: string): boolean {
  return pathname === SET_PASSWORD_PATH || pathname.startsWith(`${SET_PASSWORD_PATH}/`)
}

/** Landing path right after a sign-in, so a flagged user skips the hop through the app shell. */
export function postSignInPath(user: Pick<AuthUser, 'mustSetPassword'> | null | undefined): string {
  return mustSetPassword(user) ? SET_PASSWORD_PATH : APP_HOME_PATH
}

/**
 * The redirect the gate must perform for `pathname`, or `null` to render it.
 *
 * - flagged user on any app route → `/set-password` (no other route is reachable);
 * - unflagged user on `/set-password` → `/`.
 * - signed out → `null`: the `/login` redirect is already owned by the
 *   middleware (no session cookie), `SessionInitializer` (dead session) and
 *   `forceLogout` (revoked mid-session). A second navigation from here would
 *   race theirs and drop the `?reason=` the login screen explains.
 */
export function setPasswordRedirect(
  pathname: string,
  user: Pick<AuthUser, 'mustSetPassword'> | null | undefined,
): string | null {
  if (!user) return null
  const onSetPasswordPage = isSetPasswordPath(pathname)
  if (mustSetPassword(user)) return onSetPasswordPage ? null : SET_PASSWORD_PATH
  return onSetPasswordPage ? APP_HOME_PATH : null
}
