import { describe, it, expect } from 'vitest'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { isLoginNotice, isLogoutReason, loginPath, logoutReasonFromError } from '@/lib/auth/force-logout'
import { logoutReasonFromBody } from '@/lib/auth/logout-reason'

function errWith(data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status: 401, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

describe('force-logout helpers', () => {
  it('only allow-listed codes become a login reason', () => {
    expect(isLogoutReason('ACCOUNT_BLOCKED')).toBe(true)
    expect(isLogoutReason('SESSION_REVOKED')).toBe(false)
    expect(isLogoutReason('<script>')).toBe(false)
    expect(isLogoutReason(null)).toBe(false)
  })

  it('extracts the reason from a typed error body', () => {
    expect(logoutReasonFromError(errWith({ code: 'ACCOUNT_BLOCKED' }))).toBe('ACCOUNT_BLOCKED')
    expect(logoutReasonFromError(errWith({ code: 'SESSION_REVOKED' }))).toBeUndefined()
    expect(logoutReasonFromError(new Error('boom'))).toBeUndefined()
  })

  it('builds the login path', () => {
    expect(loginPath()).toBe('/login')
    expect(loginPath('ACCOUNT_BLOCKED')).toBe('/login?reason=ACCOUNT_BLOCKED')
    expect(loginPath('ACCOUNT_NOT_PROVISIONED')).toBe('/login?reason=ACCOUNT_NOT_PROVISIONED')
  })

  it('login notices cover OAuth redirect errors but never arbitrary text', () => {
    expect(isLoginNotice('ACCOUNT_BLOCKED')).toBe(true)
    expect(isLoginNotice('ACCOUNT_NOT_PROVISIONED')).toBe(true)
    expect(isLoginNotice('INVITATION_PENDING')).toBe(true)
    expect(isLoginNotice('SESSION_REVOKED')).toBe(false)
    expect(isLoginNotice('<script>')).toBe(false)
    // Only an allow-listed logout reason may come from a failed request.
    expect(logoutReasonFromError(errWith({ code: 'ACCOUNT_NOT_PROVISIONED' }))).toBeUndefined()
  })

  describe('SSO_REQUIRED (contract 13 C)', () => {
    it('is a forced-logout reason and a login notice', () => {
      expect(isLogoutReason('SSO_REQUIRED')).toBe(true)
      expect(isLoginNotice('SSO_REQUIRED')).toBe(true)
      expect(loginPath('SSO_REQUIRED')).toBe('/login?reason=SSO_REQUIRED')
      // The admin-side error is never a login notice.
      expect(isLoginNotice('SSO_ENFORCE_NOT_READY')).toBe(false)
    })

    it('is read from a typed code or from the sso_enforced revocation reason', () => {
      expect(logoutReasonFromError(errWith({ code: 'SSO_REQUIRED' }))).toBe('SSO_REQUIRED')
      expect(logoutReasonFromError(errWith({ code: 'SESSION_REVOKED', reason: 'sso_enforced' }))).toBe('SSO_REQUIRED')
      expect(
        logoutReasonFromError(errWith({ code: 'SESSION_REVOKED', params: { reason: 'sso_enforced' } })),
      ).toBe('SSO_REQUIRED')
      // Other revocation reasons stay a plain logout.
      expect(logoutReasonFromError(errWith({ code: 'SESSION_REVOKED', reason: 'role_changed' }))).toBeUndefined()
      expect(logoutReasonFromError(errWith({ code: 'SESSION_REVOKED', params: { reason: '<b>x</b>' } }))).toBeUndefined()
    })
  })

  describe('logoutReasonFromBody (shared with the cookie routes)', () => {
    it('only ever returns an allow-listed reason', () => {
      expect(logoutReasonFromBody({ code: 'ACCOUNT_BLOCKED' })).toBe('ACCOUNT_BLOCKED')
      expect(logoutReasonFromBody({ reason: 'SSO_REQUIRED' })).toBe('SSO_REQUIRED')
      expect(logoutReasonFromBody({ code: 'REFRESH_TOKEN_ROTATED' })).toBeUndefined()
      expect(logoutReasonFromBody({ params: 'sso_enforced' })).toBeUndefined()
      expect(logoutReasonFromBody('SSO_REQUIRED')).toBeUndefined()
      expect(logoutReasonFromBody(null)).toBeUndefined()
      expect(logoutReasonFromBody(undefined)).toBeUndefined()
    })
  })
})
