import axios from 'axios'
import type { MfaChallenge } from '@/lib/api/types'
import { authCodeToI18nKey, parseAuthError } from '@/lib/auth/auth-error'

/**
 * Second sign-in step for privileged users (contract 09). `POST /auth/login`
 * and `POST /auth/exchange` answer `{ code: 'MFA_REQUIRED', mfaToken, … }`
 * instead of tokens; the login / oauth-callback screens park that challenge
 * here and send the browser to `/mfa`, which finishes the sign-in.
 *
 * The challenge lives in memory. sessionStorage is only a fallback for a reload
 * of `/mfa` (same tab, gone when the tab closes) and is cleared on success or
 * abort. The server keeps the token 5 minutes, so an older copy is dropped.
 * Enrollment also records its stage (contract 11): once `enroll/confirm`
 * succeeded the token lives 10 more minutes in stage `codes_pending`, and a
 * reload re-fetches the same backup codes — the codes themselves are never
 * stored here. Mirror of the mobile `MfaScreen` flow.
 */
export const MFA_PATH = '/mfa'

const STORAGE_KEY = 'pon:auth:mfa'
export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000
/** Server TTL of an enrollment in stage `codes_pending`, counted from confirm. */
export const MFA_CODES_PENDING_TTL_MS = 10 * 60 * 1000

/** `codes_pending`: 2FA is on and the backup codes are issued, but no session yet. */
export type MfaStage = 'codes_pending'

export interface PendingMfa extends MfaChallenge {
  /** epoch ms when the challenge was received. */
  receivedAt: number
  /** Enrollment stage reached on the server; absent = not confirmed yet. */
  stage?: MfaStage
  /** epoch ms when `stage` was reached (its own server TTL starts then). */
  stageAt?: number
}

let pending: PendingMfa | null = null
/** The last restore found a stored challenge past its TTL (cleared by save / clear). */
let expiredOnRestore = false

function persist(value: PendingMfa): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage blocked — the in-memory copy still covers the client-side hop.
  }
}

function expiresAt(p: PendingMfa): number {
  return p.stage === 'codes_pending' && p.stageAt !== undefined
    ? p.stageAt + MFA_CODES_PENDING_TTL_MS
    : p.receivedAt + MFA_CHALLENGE_TTL_MS
}

/** True when a sign-in answer is a 2FA challenge rather than tokens. */
export function isMfaChallenge(data: unknown): data is MfaChallenge {
  if (!data || typeof data !== 'object') return false
  const d = data as { code?: unknown; mfaToken?: unknown }
  return d.code === 'MFA_REQUIRED' && typeof d.mfaToken === 'string' && d.mfaToken.length > 0
}

/** Park a challenge for `/mfa`. */
export function savePendingMfa(challenge: MfaChallenge, now = Date.now()): void {
  expiredOnRestore = false
  pending = {
    code: 'MFA_REQUIRED',
    mfaToken: challenge.mfaToken,
    enrollmentRequired: challenge.enrollmentRequired === true,
    user: challenge.user,
    receivedAt: now,
  }
  persist(pending)
}

/**
 * `enroll/confirm` succeeded: remember the stage so a reload of `/mfa` shows the
 * backup codes again (via `enroll/codes`) instead of the setup steps.
 */
export function markMfaCodesPending(now = Date.now()): void {
  if (!pending) return
  pending = { ...pending, stage: 'codes_pending', stageAt: now }
  persist(pending)
}

/**
 * The parked challenge, or `null`. Returns the same object on every call (safe
 * as a `useSyncExternalStore` snapshot); the sessionStorage copy is only read
 * when memory is empty, i.e. after a reload.
 */
export function readPendingMfa(now = Date.now()): PendingMfa | null {
  if (pending) return pending
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const meta = (parsed ?? {}) as { receivedAt?: unknown; stage?: unknown; stageAt?: unknown }
    if (!isMfaChallenge(parsed) || typeof meta.receivedAt !== 'number') {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    const restored: PendingMfa = {
      code: 'MFA_REQUIRED',
      mfaToken: parsed.mfaToken,
      enrollmentRequired: parsed.enrollmentRequired === true,
      user: parsed.user,
      receivedAt: meta.receivedAt,
      ...(meta.stage === 'codes_pending' && typeof meta.stageAt === 'number'
        ? { stage: 'codes_pending' as const, stageAt: meta.stageAt }
        : {}),
    }
    if (now > expiresAt(restored)) {
      sessionStorage.removeItem(STORAGE_KEY)
      expiredOnRestore = true
      return null
    }
    pending = restored
    return pending
  } catch {
    return null
  }
}

/**
 * True when the last restore dropped a stored challenge because the server has
 * expired it by now — `/mfa` then explains "sign in again" instead of a bare /login.
 */
export function pendingMfaExpired(): boolean {
  return expiredOnRestore
}

/** Forget the challenge (sign-in finished or abandoned). */
export function clearPendingMfa(): void {
  pending = null
  expiredOnRestore = false
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Codes after which the challenge is unusable: the user has to sign in again.
 * Each one is also a login notice, so `/login?reason=CODE` explains why.
 */
export const MFA_RESTART_CODES = [
  'MFA_TOKEN_INVALID',
  'MFA_TOO_MANY_ATTEMPTS',
  'MFA_NOT_ENROLLED',
  'MFA_ALREADY_ENROLLED',
] as const
export type MfaRestartCode = (typeof MFA_RESTART_CODES)[number]

export function isMfaRestartCode(code: unknown): code is MfaRestartCode {
  return typeof code === 'string' && (MFA_RESTART_CODES as readonly string[]).includes(code)
}

/** A localized message: `auth`-namespace key + ICU values. */
export interface MfaErrorMessage {
  key: string
  values?: Record<string, string | number>
}

/**
 * Map a failed 2FA request to an `auth.*` message — never raw server text.
 * `MFA_CODE_INVALID` carries `params.remaining`; when it is absent the plain
 * variant is used so the ICU message never misses its placeholder.
 */
export function mfaErrorMessage(err: unknown): MfaErrorMessage & { code: string } {
  if (axios.isAxiosError(err) && err.response?.status === 429) {
    return { code: 'RATE_LIMITED', key: 'mfa.rateLimited' }
  }
  const { code, params } = parseAuthError(err)
  if (code === 'MFA_CODE_INVALID') {
    const remaining = Number(params?.remaining)
    return Number.isFinite(remaining) && params?.remaining !== undefined
      ? { code, key: 'errMfaCodeInvalidWithRemaining', values: { remaining } }
      : { code, key: 'errMfaCodeInvalid' }
  }
  return { code, key: authCodeToI18nKey(code), values: params }
}

/**
 * Same mapping for the signed-in "Regenerate backup codes" call. There,
 * MFA_TOO_MANY_ATTEMPTS is a temporary lockout of that action — the session is
 * fine — so it reads "wait and try again", not the sign-in step's "sign in again".
 */
export function mfaAccountErrorMessage(err: unknown): MfaErrorMessage & { code: string } {
  const msg = mfaErrorMessage(err)
  return msg.code === 'MFA_TOO_MANY_ATTEMPTS' ? { code: msg.code, key: 'mfa.rateLimited' } : msg
}

/** 6-digit authenticator code. */
export const TOTP_LENGTH = 6

/**
 * Normalise what the user typed into a backup code: uppercase, letters and
 * digits only, `XXXXX-XXXXX` once past five characters. Max 10 characters.
 */
export function formatBackupCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw
}

export function isCompleteBackupCode(value: string): boolean {
  return /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(value)
}
