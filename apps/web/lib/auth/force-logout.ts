import axios from 'axios'
import { useAuthStore } from '@/lib/store/auth.store'
import { LOGOUT_REASONS, logoutReasonFromBody, type LogoutReason } from '@/lib/auth/logout-reason'

/**
 * Reasons the login screen can explain after a forced logout live in
 * `logout-reason.ts` (shared with the cookie route handlers). Only codes in
 * that allow-list ever reach the URL (`/login?reason=CODE`) — anything else is
 * a plain logout with no message, so arbitrary server text can never be echoed.
 */
export { LOGOUT_REASONS, isLogoutReason, type LogoutReason } from '@/lib/auth/logout-reason'

/**
 * Codes the login screen may show as a persistent notice (`/login?reason=CODE`):
 * the forced-logout reasons plus every code the auth-service can put in a
 * Google / SSO error redirect (`/oauth-callback?error=CODE`). A banner instead
 * of a toast, because the toast fired on /oauth-callback can disappear before
 * /login has even rendered.
 */
export const LOGIN_NOTICES = [
  ...LOGOUT_REASONS,
  'ACCOUNT_NOT_PROVISIONED',
  'INVITATION_PENDING',
  'INVITATION_INVALID',
  'INVITATION_EXPIRED',
  'INVITATION_REVOKED',
  'INVITATION_ALREADY_ACCEPTED',
  'INVITATION_EMAIL_MISMATCH',
  'MEMBER_ALREADY_EXISTS',
  'SOCIAL_EMAIL_UNAVAILABLE',
  'SSO_DISABLED',
  'SSO_DOMAIN_NOT_ALLOWED',
  // "Sign in with SSO" while the company IdP is unreachable (auth-service 503).
  'SSO_UNAVAILABLE',
  // The 2FA step (`/mfa`) became unusable — expired/used token, too many wrong
  // codes, wrong step — and the user must sign in again (see lib/auth/mfa.ts).
  'MFA_TOKEN_INVALID',
  'MFA_TOO_MANY_ATTEMPTS',
  'MFA_NOT_ENROLLED',
  'MFA_ALREADY_ENROLLED',
  'GENERIC_ERROR',
] as const
export type LoginNotice = (typeof LOGIN_NOTICES)[number]

export function isLoginNotice(value: unknown): value is LoginNotice {
  return typeof value === 'string' && (LOGIN_NOTICES as readonly string[]).includes(value)
}

/**
 * The logout reason carried by a failed request / refresh, if it is a known
 * one: a typed code (`ACCOUNT_BLOCKED`, `SSO_REQUIRED`) or the `sso_enforced`
 * revocation reason (see `logoutReasonFromBody`).
 */
export function logoutReasonFromError(err: unknown): LogoutReason | undefined {
  if (!axios.isAxiosError(err)) return undefined
  return logoutReasonFromBody(err.response?.data)
}

/** `/login`, or `/login?reason=CODE` when the logout has a reason the login screen explains. */
export function loginPath(reason?: LoginNotice): string {
  return reason ? `/login?reason=${reason}` : '/login'
}

/**
 * Session is dead (refresh rejected, account blocked): drop in-memory auth,
 * wipe the httpOnly cookies and hard-navigate to the login screen. The hard
 * navigation also tears down the STOMP singleton and every in-flight query.
 */
export async function forceLogout(err?: unknown): Promise<void> {
  useAuthStore.getState().clearAuth()
  if (typeof window === 'undefined') return
  await axios.post('/api/auth/clear-cookie').catch(() => {})
  window.location.href = loginPath(logoutReasonFromError(err))
}
