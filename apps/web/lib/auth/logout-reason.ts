/**
 * Forced-logout reasons the login screen explains (`/login?reason=CODE`).
 *
 * Kept free of client-only imports so the Next.js route handlers
 * (`/api/auth/refresh`, `/api/auth/session`) can forward the same allow-listed
 * code the browser later shows — nothing else from an upstream body ever
 * reaches the URL, so arbitrary server text can never be echoed.
 *
 * - `ACCOUNT_BLOCKED`: the account was blocked while signed in.
 * - `SSO_REQUIRED`: the workspace now requires single sign-on for this email
 *   domain, so a password / Google session was signed out (contract 13 C).
 */
export const LOGOUT_REASONS = ['ACCOUNT_BLOCKED', 'SSO_REQUIRED'] as const
export type LogoutReason = (typeof LOGOUT_REASONS)[number]

export function isLogoutReason(value: unknown): value is LogoutReason {
  return typeof value === 'string' && (LOGOUT_REASONS as readonly string[]).includes(value)
}

/** Session revocation reasons (auth-service `SessionRevokeReason`) the login screen explains. */
const REVOKE_REASONS: Readonly<Record<string, LogoutReason>> = {
  sso_enforced: 'SSO_REQUIRED',
}

function revokeReason(value: unknown): LogoutReason | undefined {
  if (typeof value !== 'string') return undefined
  return isLogoutReason(value) ? value : REVOKE_REASONS[value]
}

/**
 * The logout reason carried by an auth-service rejection body, if any: a typed
 * `code` (`ACCOUNT_BLOCKED`, `SSO_REQUIRED`), or a revocation `reason`
 * (`sso_enforced`) at the top level or under `params`.
 */
export function logoutReasonFromBody(data: unknown): LogoutReason | undefined {
  if (!data || typeof data !== 'object') return undefined
  const body = data as { code?: unknown; reason?: unknown; params?: unknown }
  if (isLogoutReason(body.code)) return body.code
  const params = body.params && typeof body.params === 'object'
    ? (body.params as { reason?: unknown })
    : undefined
  return revokeReason(body.reason) ?? revokeReason(params?.reason)
}
