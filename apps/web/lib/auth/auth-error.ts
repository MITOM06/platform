import { AxiosError } from 'axios'

interface AuthErrorBody {
  code: string
  params?: Record<string, string | number>
}

/** Extract { code, params } from an AxiosError thrown by auth-service. */
export function parseAuthError(err: unknown): { code: string; params?: Record<string, string | number> } {
  const e = err as AxiosError<{ code?: string; params?: Record<string, string | number>; message?: unknown }>
  const data = e?.response?.data
  // Business errors: NestJS replies with the thrown object verbatim, so the
  // body is `{ code, params }` at the top level (no `message` wrapper).
  if (data && typeof data.code === 'string' && data.code) {
    return { code: data.code, params: data.params }
  }
  const msg = data?.message
  // Defensive: also accept a nested `{ message: { code, params } }` shape.
  if (typeof msg === 'object' && msg !== null && !Array.isArray(msg)) {
    const body = msg as AuthErrorBody
    if (body.code) return { code: body.code, params: body.params }
  }
  // Validation errors (class-validator) arrive as `{ message: ["VAL_..."] }`.
  if (Array.isArray(msg) && msg.length > 0) {
    return { code: String(msg[0]) }
  }
  return { code: 'GENERIC_ERROR' }
}

/** Map an auth-service error code to a next-intl translation key path. */
export function authCodeToI18nKey(code: string): string {
  const map: Record<string, string> = {
    // Success codes
    LOGIN_SUCCESS: 'msgLoginSuccess',
    LOGOUT_SUCCESS: 'msgLogoutSuccess',
    OTP_SENT: 'msgOtpSent',
    OTP_VALID: 'msgOtpValid',
    OTP_RESENT: 'msgOtpResent',
    PASSWORD_UPDATED: 'msgPasswordUpdated',
    ACCOUNT_UNVERIFIED_OTP_SENT: 'msgAccountUnverifiedOtpSent',
    INVITATION_ACCEPTED: 'msgInvitationAccepted',
    // Error codes
    OTP_INVALID: 'errOtpInvalid',
    OTP_EXPIRED: 'errOtpExpired',
    OTP_ATTEMPTS_EXCEEDED: 'errOtpAttemptsExceeded',
    OTP_WRONG_WITH_REMAINING: 'errOtpWrongWithRemaining',
    OTP_RESEND_COOLDOWN: 'errOtpResendCooldown',
    TOO_MANY_OTP_REQUESTS: 'errTooManyOtpRequests',
    OTP_SEND_FAILED: 'errOtpSendFailed',
    ACCOUNT_LOCKED: 'errAccountLocked',
    LOGIN_FAILED_WITH_REMAINING: 'errLoginFailedWithRemaining',
    LOGIN_FAILED_LOCKED: 'errLoginFailedLocked',
    TOKEN_INVALID: 'errTokenInvalid',
    SESSION_NOT_FOUND: 'errSessionNotFound',
    SESSION_INVALID: 'errSessionInvalid',
    SESSION_REVOKED: 'errSessionRevoked',
    REFRESH_TOKEN_REUSE: 'errRefreshTokenReuse',
    REFRESH_TOKEN_INVALID: 'errRefreshTokenInvalid',
    REFRESH_TOKEN_ROTATED: 'errRefreshTokenRotated',
    TOKEN_SESSION_MISMATCH: 'errTokenSessionMismatch',
    // 503 while the session store is unreachable — transient, never a logout.
    SESSION_CHECK_UNAVAILABLE: 'errGeneric',
    SOCIAL_EMAIL_UNAVAILABLE: 'errSocialEmailUnavailable',
    LOGIN_CODE_INVALID: 'errLoginCodeInvalid',
    EMAIL_NOT_FOUND: 'errEmailNotFound',
    USER_NOT_FOUND: 'errUserNotFound',
    // Change / first set password (POST /api/users/me/change-password)
    CURRENT_PASSWORD_REQUIRED: 'errCurrentPasswordRequired',
    CURRENT_PASSWORD_INCORRECT: 'errCurrentPasswordIncorrect',
    // Invite-only onboarding / account status
    ACCOUNT_NOT_PROVISIONED: 'errAccountNotProvisioned',
    ACCOUNT_BLOCKED: 'errAccountBlocked',
    INVITATION_PENDING: 'errInvitationPending',
    INVITATION_INVALID: 'errInvitationInvalid',
    INVITATION_EXPIRED: 'errInvitationExpired',
    INVITATION_REVOKED: 'errInvitationRevoked',
    INVITATION_ALREADY_ACCEPTED: 'errInvitationAlreadyAccepted',
    INVITATION_EMAIL_MISMATCH: 'errInvitationEmailMismatch',
    INVITATION_ALREADY_PENDING: 'errInvitationAlreadyPending',
    INVITATION_NOT_PENDING: 'errInvitationNotPending',
    INVITATION_NOT_FOUND: 'errInvitationNotFound',
    INVITATION_RESEND_COOLDOWN: 'errInvitationResendCooldown',
    // Admin member management
    MEMBER_ALREADY_EXISTS: 'errMemberAlreadyExists',
    MEMBER_NOT_FOUND: 'errMemberNotFound',
    ROLE_NOT_FOUND: 'errRoleNotFound',
    DEPARTMENT_NOT_FOUND: 'errDepartmentNotFound',
    OWNER_ROLE_ASSIGN_FORBIDDEN: 'errOwnerRoleAssignForbidden',
    CANNOT_CHANGE_OWN_ROLE: 'errCannotChangeOwnRole',
    LAST_OWNER_CANNOT_BE_DEMOTED: 'errLastOwnerCannotBeDemoted',
    CANNOT_BLOCK_SELF: 'errCannotBlockSelf',
    OWNER_BLOCK_FORBIDDEN: 'errOwnerBlockForbidden',
    LAST_OWNER_CANNOT_BE_BLOCKED: 'errLastOwnerCannotBeBlocked',
    // Two-factor authentication (contract 09). MFA_CODE_INVALID with
    // `params.remaining` uses errMfaCodeInvalidWithRemaining (lib/auth/mfa.ts).
    MFA_REQUIRED: 'msgMfaRequired',
    MFA_TOKEN_INVALID: 'errMfaTokenInvalid',
    MFA_CODE_INVALID: 'errMfaCodeInvalid',
    MFA_TOO_MANY_ATTEMPTS: 'errMfaTooManyAttempts',
    MFA_NOT_ENROLLED: 'errMfaNotEnrolled',
    MFA_ALREADY_ENROLLED: 'errMfaAlreadyEnrolled',
    MFA_RESET_FORBIDDEN: 'errMfaResetForbidden',
    MFA_RESET_SELF_FORBIDDEN: 'errMfaResetSelfForbidden',
    // Turning 2FA off is refused: the role (Owner/Admin-like) requires it (contract 15).
    MFA_REQUIRED_BY_ROLE: 'errMfaRequiredByRole',
    // SSO
    SSO_DISABLED: 'errSsoDisabled',
    SSO_DOMAIN_NOT_ALLOWED: 'errSsoDomainNotAllowed',
    // Require-SSO switch (contract 13 C): password / Google / reset are off for
    // this email domain; the admin tried to require SSO before it was set up.
    SSO_REQUIRED: 'errSsoRequired',
    // The company IdP could not be reached (OIDC discovery failed); retryable.
    SSO_UNAVAILABLE: 'errSsoUnavailable',
    SSO_ENFORCE_NOT_READY: 'errSsoEnforceNotReady',
    // Validation codes
    VAL_EMAIL_INVALID: 'errValEmailInvalid',
    VAL_EMAIL_REQUIRED: 'errValEmailRequired',
    VAL_DISPLAYNAME_REQUIRED: 'errValDisplayNameRequired',
    VAL_DISPLAYNAME_TOO_SHORT: 'errValDisplayNameTooShort',
    VAL_PASSWORD_TOO_SHORT: 'errValPasswordTooShort',
    // Fallback
    GENERIC_ERROR: 'errGeneric',
  }
  return map[code] ?? 'errGeneric'
}
