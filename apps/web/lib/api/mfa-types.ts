// ── Two-factor authentication (TOTP) DTOs — contracts 09 + 11 ───────────────
// Contract-derived from the generated auth-service client (`pnpm gen:api-types`),
// re-exported by `lib/api/types.ts` — import them from there. Kept in their own
// file so `types.ts` stays under the 400-line limit.
import type { components as AuthApiComponents } from './generated/auth-api'

type Schemas = AuthApiComponents['schemas']

/**
 * `POST /auth/login` / `POST /auth/exchange` answer for a privileged user
 * (Owner, Admin, or a role with MANAGE_WORKSPACE/MEMBERS/ROLES): no tokens yet,
 * a second step on `/mfa` is required. `enrollmentRequired` = first sign-in
 * since becoming privileged → set up the authenticator first.
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
