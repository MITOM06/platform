import { AxiosError } from 'axios'

interface AuthErrorBody {
  code: string
  params?: Record<string, unknown>
}

/** Extract { code, params } from an AxiosError thrown by auth-service. */
export function parseAuthError(err: unknown): { code: string; params?: Record<string, unknown> } {
  const e = err as AxiosError<{ message?: unknown }>
  const msg = e?.response?.data?.message
  if (typeof msg === 'object' && msg !== null && !Array.isArray(msg)) {
    const body = msg as AuthErrorBody
    if (body.code) return { code: body.code, params: body.params }
  }
  if (Array.isArray(msg) && msg.length > 0) {
    return { code: String(msg[0]) }
  }
  return { code: 'GENERIC_ERROR' }
}

/** Map an auth-service error code to a next-intl translation key path. */
export function authCodeToI18nKey(code: string): string {
  const map: Record<string, string> = {
    // Success codes
    LOGIN_SUCCESS: 'auth.msgLoginSuccess',
    LOGOUT_SUCCESS: 'auth.msgLogoutSuccess',
    OTP_SENT: 'auth.msgOtpSent',
    OTP_VALID: 'auth.msgOtpValid',
    OTP_RESENT: 'auth.msgOtpResent',
    PASSWORD_UPDATED: 'auth.msgPasswordUpdated',
    REGISTER_SUCCESS: 'auth.msgRegisterSuccess',
    ACCOUNT_UNVERIFIED_OTP_SENT: 'auth.msgAccountUnverifiedOtpSent',
    // Error codes
    OTP_INVALID: 'auth.errOtpInvalid',
    OTP_EXPIRED: 'auth.errOtpExpired',
    OTP_ATTEMPTS_EXCEEDED: 'auth.errOtpAttemptsExceeded',
    OTP_WRONG_WITH_REMAINING: 'auth.errOtpWrongWithRemaining',
    OTP_RESEND_COOLDOWN: 'auth.errOtpResendCooldown',
    EMAIL_DOMAIN_INVALID: 'auth.errEmailDomainInvalid',
    ACCOUNT_LOCKED: 'auth.errAccountLocked',
    LOGIN_FAILED_WITH_REMAINING: 'auth.errLoginFailedWithRemaining',
    LOGIN_FAILED_LOCKED: 'auth.errLoginFailedLocked',
    TOKEN_INVALID: 'auth.errTokenInvalid',
    SESSION_NOT_FOUND: 'auth.errSessionNotFound',
    SESSION_INVALID: 'auth.errSessionInvalid',
    SESSION_REVOKED: 'auth.errSessionRevoked',
    REFRESH_TOKEN_REUSE: 'auth.errRefreshTokenReuse',
    REFRESH_TOKEN_INVALID: 'auth.errRefreshTokenInvalid',
    REFRESH_TOKEN_ROTATED: 'auth.errRefreshTokenRotated',
    TOKEN_SESSION_MISMATCH: 'auth.errTokenSessionMismatch',
    SOCIAL_EMAIL_UNAVAILABLE: 'auth.errSocialEmailUnavailable',
    LOGIN_CODE_INVALID: 'auth.errLoginCodeInvalid',
    EMAIL_NOT_FOUND: 'auth.errEmailNotFound',
    USER_NOT_FOUND: 'auth.errUserNotFound',
    EMAIL_IN_USE: 'auth.errEmailInUse',
    // Validation codes
    VAL_EMAIL_INVALID: 'auth.errValEmailInvalid',
    VAL_EMAIL_REQUIRED: 'auth.errValEmailRequired',
    VAL_DISPLAYNAME_REQUIRED: 'auth.errValDisplayNameRequired',
    VAL_DISPLAYNAME_TOO_SHORT: 'auth.errValDisplayNameTooShort',
    VAL_PASSWORD_TOO_SHORT: 'auth.errValPasswordTooShort',
    // Fallback
    GENERIC_ERROR: 'auth.errGeneric',
  }
  return map[code] ?? 'auth.errGeneric'
}
