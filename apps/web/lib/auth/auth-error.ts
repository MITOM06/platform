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
    REGISTER_SUCCESS: 'msgRegisterSuccess',
    ACCOUNT_UNVERIFIED_OTP_SENT: 'msgAccountUnverifiedOtpSent',
    // Error codes
    OTP_INVALID: 'errOtpInvalid',
    OTP_EXPIRED: 'errOtpExpired',
    OTP_ATTEMPTS_EXCEEDED: 'errOtpAttemptsExceeded',
    OTP_WRONG_WITH_REMAINING: 'errOtpWrongWithRemaining',
    OTP_RESEND_COOLDOWN: 'errOtpResendCooldown',
    EMAIL_DOMAIN_INVALID: 'errEmailDomainInvalid',
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
    SOCIAL_EMAIL_UNAVAILABLE: 'errSocialEmailUnavailable',
    LOGIN_CODE_INVALID: 'errLoginCodeInvalid',
    EMAIL_NOT_FOUND: 'errEmailNotFound',
    USER_NOT_FOUND: 'errUserNotFound',
    EMAIL_IN_USE: 'errEmailInUse',
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
