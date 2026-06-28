/**
 * Stable machine-readable codes for all auth-service responses and errors.
 * Values intentionally equal their keys (SCREAMING_SNAKE) so they are
 * self-documenting in JSON payloads and can be used as-is in i18n keys.
 *
 * These codes are the CLIENT CONTRACT. Never remove or rename a code that
 * has been shipped — add new ones instead.
 * See docs/auth-error-codes.md for the full table including HTTP status and
 * English default text.
 */
export enum AuthCode {
  // ── Success / info ──────────────────────────────────────────────────────
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGOUT_SUCCESS = 'LOGOUT_SUCCESS',
  OTP_SENT = 'OTP_SENT',
  OTP_VALID = 'OTP_VALID',
  OTP_RESENT = 'OTP_RESENT',
  PASSWORD_UPDATED = 'PASSWORD_UPDATED',
  REGISTER_SUCCESS = 'REGISTER_SUCCESS',
  ACCOUNT_UNVERIFIED_OTP_SENT = 'ACCOUNT_UNVERIFIED_OTP_SENT',

  // ── 400 Bad Request ─────────────────────────────────────────────────────
  OTP_INVALID = 'OTP_INVALID',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_ATTEMPTS_EXCEEDED = 'OTP_ATTEMPTS_EXCEEDED',
  OTP_WRONG_WITH_REMAINING = 'OTP_WRONG_WITH_REMAINING',
  OTP_RESEND_COOLDOWN = 'OTP_RESEND_COOLDOWN',
  TOO_MANY_OTP_REQUESTS = 'TOO_MANY_OTP_REQUESTS',
  EMAIL_DOMAIN_INVALID = 'EMAIL_DOMAIN_INVALID',

  // ── 401 Unauthorized ────────────────────────────────────────────────────
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  LOGIN_FAILED_WITH_REMAINING = 'LOGIN_FAILED_WITH_REMAINING',
  LOGIN_FAILED_LOCKED = 'LOGIN_FAILED_LOCKED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_REVOKED = 'SESSION_REVOKED',
  TOKEN_SESSION_MISMATCH = 'TOKEN_SESSION_MISMATCH',
  SOCIAL_EMAIL_UNAVAILABLE = 'SOCIAL_EMAIL_UNAVAILABLE',
  LOGIN_CODE_INVALID = 'LOGIN_CODE_INVALID',
  REFRESH_TOKEN_REUSE = 'REFRESH_TOKEN_REUSE',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_ROTATED = 'REFRESH_TOKEN_ROTATED',

  // ── 404 Not Found ───────────────────────────────────────────────────────
  EMAIL_NOT_FOUND = 'EMAIL_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // ── 409 Conflict ────────────────────────────────────────────────────────
  EMAIL_IN_USE = 'EMAIL_IN_USE',

  // ── Validation (class-validator, used as message string in decorators) ──
  VAL_EMAIL_INVALID = 'VAL_EMAIL_INVALID',
  VAL_EMAIL_REQUIRED = 'VAL_EMAIL_REQUIRED',
  VAL_DISPLAYNAME_REQUIRED = 'VAL_DISPLAYNAME_REQUIRED',
  VAL_DISPLAYNAME_TOO_SHORT = 'VAL_DISPLAYNAME_TOO_SHORT',
  VAL_PASSWORD_TOO_SHORT = 'VAL_PASSWORD_TOO_SHORT',
}
