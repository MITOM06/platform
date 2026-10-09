import { describe, it, expect, beforeEach } from 'vitest'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  MFA_CHALLENGE_TTL_MS,
  MFA_CODES_PENDING_TTL_MS,
  clearPendingMfa,
  formatBackupCode,
  isCompleteBackupCode,
  isMfaChallenge,
  isMfaRestartCode,
  markMfaCodesPending,
  mfaAccountErrorMessage,
  mfaErrorMessage,
  mfaSelfErrorMessage,
  pendingMfaExpired,
  readPendingMfa,
  savePendingMfa,
} from '@/lib/auth/mfa'
import { authCodeToI18nKey } from '@/lib/auth/auth-error'
import { isLoginNotice, loginPath } from '@/lib/auth/force-logout'
import type { MfaChallenge } from '@/lib/api/types'

const challenge: MfaChallenge = {
  code: 'MFA_REQUIRED',
  mfaToken: 'tok-123',
  enrollmentRequired: false,
  user: { id: 'u1', email: 'owner@acme.com', displayName: 'Olga' },
}

function errWith(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

describe('mfa helpers', () => {
  beforeEach(() => {
    clearPendingMfa()
    sessionStorage.clear()
  })

  it('recognises a 2FA challenge and never a token response', () => {
    expect(isMfaChallenge(challenge)).toBe(true)
    expect(isMfaChallenge({ code: 'LOGIN_SUCCESS', accessToken: 'a', refreshToken: 'r', sid: 's' })).toBe(false)
    expect(isMfaChallenge({ code: 'MFA_REQUIRED' })).toBe(false)
    expect(isMfaChallenge({ code: 'MFA_REQUIRED', mfaToken: '' })).toBe(false)
    expect(isMfaChallenge(null)).toBe(false)
  })

  it('keeps the challenge in memory and returns the same object every time', () => {
    savePendingMfa(challenge, 1000)
    const a = readPendingMfa(1000)
    expect(a).toMatchObject({ mfaToken: 'tok-123', enrollmentRequired: false, receivedAt: 1000 })
    expect(readPendingMfa(2000)).toBe(a)
  })

  it('restores from sessionStorage after a reload, but not once the server TTL passed', () => {
    savePendingMfa({ ...challenge, enrollmentRequired: true }, 1000)
    const stored = sessionStorage.getItem('pon:auth:mfa')
    clearPendingMfa() // simulate the reload: memory and storage gone…
    sessionStorage.setItem('pon:auth:mfa', stored!) // …but the tab's storage survives

    expect(readPendingMfa(1000 + 1000)).toMatchObject({ mfaToken: 'tok-123', enrollmentRequired: true })

    clearPendingMfa()
    sessionStorage.setItem('pon:auth:mfa', stored!)
    expect(readPendingMfa(1000 + MFA_CHALLENGE_TTL_MS + 1)).toBeNull()
    expect(sessionStorage.getItem('pon:auth:mfa')).toBeNull()
  })

  it('flags a stored challenge dropped for its age, until the next save or clear', () => {
    savePendingMfa(challenge, 1000)
    const stored = sessionStorage.getItem('pon:auth:mfa')
    clearPendingMfa()
    expect(pendingMfaExpired()).toBe(false)
    sessionStorage.setItem('pon:auth:mfa', stored!)

    expect(readPendingMfa(1000 + MFA_CHALLENGE_TTL_MS + 1)).toBeNull()
    expect(pendingMfaExpired()).toBe(true)
    expect(readPendingMfa()).toBeNull() // storage is gone, the flag stays
    expect(pendingMfaExpired()).toBe(true)
    savePendingMfa(challenge)
    expect(pendingMfaExpired()).toBe(false)
  })

  it('parks the codes_pending stage (never the codes) with its own 10-minute TTL from confirm', () => {
    savePendingMfa({ ...challenge, enrollmentRequired: true }, 1000)
    markMfaCodesPending(1000 + 4 * 60 * 1000)
    expect(readPendingMfa()).toMatchObject({ stage: 'codes_pending', stageAt: 1000 + 4 * 60 * 1000 })
    const stored = sessionStorage.getItem('pon:auth:mfa')!
    expect(JSON.parse(stored)).not.toHaveProperty('backupCodes')

    // Reload 8 minutes after sign-in: past the 5-minute challenge TTL, within 10 minutes of confirm.
    clearPendingMfa()
    sessionStorage.setItem('pon:auth:mfa', stored)
    expect(readPendingMfa(1000 + 8 * 60 * 1000)).toMatchObject({ mfaToken: 'tok-123', stage: 'codes_pending' })

    clearPendingMfa()
    sessionStorage.setItem('pon:auth:mfa', stored)
    expect(readPendingMfa(1000 + 4 * 60 * 1000 + MFA_CODES_PENDING_TTL_MS + 1)).toBeNull()
    expect(pendingMfaExpired()).toBe(true)
  })

  it('does not invent a stage without a parked challenge, and drops a stage without its timestamp', () => {
    markMfaCodesPending()
    expect(readPendingMfa()).toBeNull()
    sessionStorage.setItem(
      'pon:auth:mfa',
      JSON.stringify({ ...challenge, receivedAt: Date.now(), stage: 'codes_pending' }),
    )
    expect(readPendingMfa()?.stage).toBeUndefined()
  })

  it('ignores a malformed stored value', () => {
    sessionStorage.setItem('pon:auth:mfa', '{not json')
    expect(readPendingMfa()).toBeNull()
    sessionStorage.setItem('pon:auth:mfa', JSON.stringify({ code: 'X', receivedAt: Date.now() }))
    expect(readPendingMfa()).toBeNull()
  })

  it('clears memory and storage', () => {
    savePendingMfa(challenge)
    clearPendingMfa()
    expect(readPendingMfa()).toBeNull()
    expect(sessionStorage.getItem('pon:auth:mfa')).toBeNull()
  })

  it('maps a wrong code with remaining attempts to the counted message', () => {
    expect(mfaErrorMessage(errWith(401, { code: 'MFA_CODE_INVALID', params: { remaining: 3 } }))).toEqual({
      code: 'MFA_CODE_INVALID',
      key: 'errMfaCodeInvalidWithRemaining',
      values: { remaining: 3 },
    })
    // Without the count the plain variant is used — never a message missing its placeholder.
    expect(mfaErrorMessage(errWith(401, { code: 'MFA_CODE_INVALID' }))).toMatchObject({ key: 'errMfaCodeInvalid' })
  })

  it('maps every MFA code to its own localized key', () => {
    expect(authCodeToI18nKey('MFA_REQUIRED')).toBe('msgMfaRequired')
    expect(authCodeToI18nKey('MFA_TOKEN_INVALID')).toBe('errMfaTokenInvalid')
    expect(authCodeToI18nKey('MFA_CODE_INVALID')).toBe('errMfaCodeInvalid')
    expect(authCodeToI18nKey('MFA_TOO_MANY_ATTEMPTS')).toBe('errMfaTooManyAttempts')
    expect(authCodeToI18nKey('MFA_NOT_ENROLLED')).toBe('errMfaNotEnrolled')
    expect(authCodeToI18nKey('MFA_ALREADY_ENROLLED')).toBe('errMfaAlreadyEnrolled')
    expect(authCodeToI18nKey('MFA_RESET_FORBIDDEN')).toBe('errMfaResetForbidden')
    expect(authCodeToI18nKey('MFA_RESET_SELF_FORBIDDEN')).toBe('errMfaResetSelfForbidden')
  })

  it('maps a throttled request and unknown failures without raw text', () => {
    expect(mfaErrorMessage(errWith(429, { message: 'ThrottlerException: Too Many Requests' }))).toMatchObject({
      key: 'mfa.rateLimited',
    })
    expect(mfaErrorMessage(new Error('Network Error'))).toMatchObject({ code: 'GENERIC_ERROR', key: 'errGeneric' })
  })

  it('reads too many wrong codes on the signed-in regenerate call as a temporary lockout', () => {
    expect(mfaAccountErrorMessage(errWith(400, { code: 'MFA_TOO_MANY_ATTEMPTS' }))).toMatchObject({
      key: 'mfa.rateLimited',
    })
    expect(mfaAccountErrorMessage(errWith(400, { code: 'MFA_CODE_INVALID', params: { remaining: 2 } }))).toMatchObject({
      key: 'errMfaCodeInvalidWithRemaining',
      values: { remaining: 2 },
    })
  })

  it('maps the signed-in turn on / turn off errors without sign-in wording (contract 15)', () => {
    expect(authCodeToI18nKey('MFA_REQUIRED_BY_ROLE')).toBe('errMfaRequiredByRole')
    expect(mfaSelfErrorMessage(errWith(400, { code: 'MFA_REQUIRED_BY_ROLE' }))).toEqual({
      code: 'MFA_REQUIRED_BY_ROLE',
      key: 'errMfaRequiredByRole',
      values: undefined,
      stale: true,
    })
    // Already on / already off: changed in another tab — never "sign in again".
    for (const code of ['MFA_ALREADY_ENROLLED', 'MFA_NOT_ENROLLED']) {
      expect(mfaSelfErrorMessage(errWith(400, { code }))).toEqual({ code, key: 'mfa.stateChanged', stale: true })
    }
    expect(mfaSelfErrorMessage(errWith(403, { code: 'SSO_REQUIRED' }))).toEqual({
      code: 'SSO_REQUIRED',
      key: 'mfa.ssoManaged',
      stale: true,
    })
    expect(mfaSelfErrorMessage(errWith(400, { code: 'MFA_CODE_INVALID', params: { remaining: 4 } }))).toEqual({
      code: 'MFA_CODE_INVALID',
      key: 'errMfaCodeInvalidWithRemaining',
      values: { remaining: 4 },
      stale: false,
    })
    expect(mfaSelfErrorMessage(errWith(400, { code: 'MFA_TOO_MANY_ATTEMPTS' }))).toMatchObject({
      key: 'mfa.rateLimited',
      stale: false,
    })
    expect(mfaSelfErrorMessage(new Error('Network Error'))).toMatchObject({ key: 'errGeneric', stale: false })
  })

  it('sends burned challenges back to /login with an explained reason', () => {
    for (const code of ['MFA_TOKEN_INVALID', 'MFA_TOO_MANY_ATTEMPTS', 'MFA_NOT_ENROLLED', 'MFA_ALREADY_ENROLLED']) {
      expect(isMfaRestartCode(code)).toBe(true)
      expect(isLoginNotice(code)).toBe(true)
    }
    expect(isMfaRestartCode('MFA_CODE_INVALID')).toBe(false)
    expect(loginPath('MFA_TOKEN_INVALID')).toBe('/login?reason=MFA_TOKEN_INVALID')
  })

  it('formats and validates backup codes', () => {
    expect(formatBackupCode('abcde')).toBe('ABCDE')
    expect(formatBackupCode('abcde2')).toBe('ABCDE-2')
    expect(formatBackupCode(' ab cd-e2 34 56 789')).toBe('ABCDE-23456')
    expect(isCompleteBackupCode('ABCDE-23456')).toBe(true)
    expect(isCompleteBackupCode('ABCDE-2345')).toBe(false)
  })
})
