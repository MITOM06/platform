// ── Two-factor authentication (TOTP) DTOs — contracts 09, 11, 15 ────────────
// Contract-derived from the generated auth-service client (`pnpm gen:api-types`),
// re-exported by `lib/api/types.ts` — import them from there. Kept in their own
// file so `types.ts` stays under the 400-line limit.
import type { components as AuthApiComponents } from './generated/auth-api'

type Schemas = AuthApiComponents['schemas']

/**
 * `POST /auth/login` / `POST /auth/exchange` / invitation accept-password
 * answer when 2FA applies (contract 15: Owner/Admin-like roles always, Members
 * who turned it on; SSO sessions and bots are exempt): no tokens yet, a second
 * step on `/mfa` is required. `enrollmentRequired` = an Owner/Admin-like
 * account without 2FA yet → set up the authenticator first.
 */
export type MfaChallenge = Schemas['MfaRequiredResponseDto']

/** `POST /auth/mfa/enroll/start` body. */
export type MfaEnrollStartRequest = Schemas['MfaEnrollStartDto']

/** `POST /auth/mfa/enroll/start` — same pending secret on every call for one token. */
export type MfaEnrollStartResponse = Schemas['MfaEnrollStartResponseDto']

/** `POST /auth/mfa/enroll/confirm` body. The web sends no device fields: confirm issues no session. */
export type MfaEnrollConfirmRequest = Schemas['MfaEnrollConfirmDto']

/**
 * `POST /auth/mfa/enroll/confirm` answer (`MFA_BACKUP_CODES_ISSUED`): 2FA is on
 * and the 10 backup codes are issued — but no tokens. The session only comes
 * from `enroll/complete`, once the user has acknowledged the codes.
 */
export type MfaEnrollConfirmResponse = Schemas['MfaEnrollConfirmResponseDto']

/** `POST /auth/mfa/enroll/codes` body → the same codes again (reload of the codes step). */
export type MfaEnrollCodesRequest = Schemas['MfaEnrollCodesDto']

/** `POST /auth/mfa/enroll/codes` answer while the enrollment waits for `complete`. */
export type MfaEnrollCodesResponse = Schemas['MfaEnrollCodesResponseDto']

/** `POST /auth/mfa/enroll/complete` body → login-success shape. Single use. */
export type MfaEnrollCompleteRequest = Schemas['MfaEnrollCompleteDto']

/** `POST /auth/mfa/verify` body — exactly one of `code` / `backupCode` (stricter than the DTO). */
export type MfaVerifyRequest = Omit<Schemas['MfaVerifyDto'], 'code' | 'backupCode'> &
  ({ code: string; backupCode?: never } | { backupCode: string; code?: never })

/** `POST /api/users/me/mfa/backup-codes` body: the current TOTP code. */
export type RegenerateBackupCodesRequest = Schemas['RegenerateBackupCodesDto']

/** Fresh backup codes (`XXXXX-XXXXX`), shown to the user exactly once. */
export type MfaBackupCodesResponse = Schemas['BackupCodesResponseDto']

// ── Self-service 2FA for optional roles (contract 15) ───────────────────────
// `POST /api/users/me/mfa/enroll/{start,confirm}` and `/disable` (JWT). A Member
// turns 2FA on/off from Settings → Security; Owner/Admin-like roles cannot turn
// it off (`MFA_REQUIRED_BY_ROLE`). None of these touch the session.

/** `POST /api/users/me/mfa/enroll/start` → pending secret (10 min). Same shape as the sign-in enroll start. */
export type SelfMfaEnrollStartResponse = Schemas['MfaEnrollStartResponseDto']

/** `POST /api/users/me/mfa/enroll/confirm` body: one code from the newly added authenticator. */
export type SelfMfaEnrollConfirmRequest = Schemas['MfaSelfEnrollConfirmDto']

/** `POST /api/users/me/mfa/enroll/confirm` answer: 2FA is on, the 10 backup codes are shown once. */
export type SelfMfaEnrollConfirmResponse = Schemas['MfaSelfEnrollConfirmResponseDto']

/** `POST /api/users/me/mfa/disable` body — exactly one of `code` / `backupCode` (stricter than the DTO). */
export type MfaDisableRequest = Omit<Schemas['MfaDisableDto'], 'code' | 'backupCode'> &
  ({ code: string; backupCode?: never } | { backupCode: string; code?: never })

/** `POST /api/users/me/mfa/disable` answer. */
export type MfaDisableResponse = Schemas['SuccessResponseDto']
