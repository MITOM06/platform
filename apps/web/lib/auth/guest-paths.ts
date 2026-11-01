/**
 * Guest-only pages — a signed-in user is sent to the app instead. Shared by
 * `middleware.ts` (every server request) and `GuestOnly` (client-side Back /
 * Forward, which never reach the middleware).
 *
 * /oauth-callback must be reachable without a session: the user lands here from
 * Google with no cookie yet — the page exchanges the code, sets cookies, then
 * redirects to '/'. It is logged-out-only, hence it belongs here.
 * /invite/<token> is logged-out-only too: a signed-in user opening an invite
 * link is bounced home (the invitation is for a not-yet-existing account).
 * /mfa is the second sign-in step (2FA for every member): it runs before any
 * session cookie exists, so it is logged-out-only as well.
 */
export const GUEST_ONLY_PATHS = [
  '/login',
  '/invite',
  '/verify-otp',
  '/oauth-callback',
  '/forgot-password',
  '/mfa',
] as const

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p))
}
