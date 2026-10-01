import { describe, it, expect } from 'vitest'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { isLoginNotice, isLogoutReason, loginPath, logoutReasonFromError } from '@/lib/auth/force-logout'

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
    // Only ACCOUNT_BLOCKED may come from a failed request as a forced-logout reason.
    expect(logoutReasonFromError(errWith({ code: 'ACCOUNT_NOT_PROVISIONED' }))).toBeUndefined()
  })
})
