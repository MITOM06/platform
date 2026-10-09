// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { NextRequest } from 'next/server'
import { POST as refreshRoute } from '@/app/api/auth/refresh/route'
import { GET as sessionRoute } from '@/app/api/auth/session/route'

vi.mock('@/lib/config/env', () => ({ serverAuthUrl: () => 'http://auth.test' }))

function upstreamError(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

function request(path: string, method: 'GET' | 'POST') {
  return new NextRequest(`http://web.test${path}`, {
    method,
    headers: { cookie: 'sid=s1; refreshToken=r1' },
  })
}

/**
 * The cookie proxies forward an allow-listed logout reason so the browser can
 * explain the sign-out on /login (contract 13 C): `SSO_REQUIRED`, also when the
 * auth-service only gives the `sso_enforced` revocation reason.
 */
describe('auth cookie routes: forced-logout reason', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([
    ['a typed SSO_REQUIRED', upstreamError(403, { code: 'SSO_REQUIRED' }), 'SSO_REQUIRED'],
    ['the sso_enforced revocation reason', upstreamError(401, { code: 'SESSION_REVOKED', reason: 'sso_enforced' }), 'SSO_REQUIRED'],
    ['ACCOUNT_BLOCKED', upstreamError(403, { code: 'ACCOUNT_BLOCKED' }), 'ACCOUNT_BLOCKED'],
  ])('/api/auth/refresh forwards %s', async (_label, err, code) => {
    vi.spyOn(axios, 'post').mockRejectedValue(err)
    const res = await refreshRoute(request('/api/auth/refresh', 'POST'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'refresh_rejected', code })
  })

  it('/api/auth/refresh still forwards other upstream codes untouched', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(upstreamError(401, { code: 'REFRESH_TOKEN_ROTATED' }))
    const res = await refreshRoute(request('/api/auth/refresh', 'POST'))
    expect(await res.json()).toEqual({ error: 'refresh_rejected', code: 'REFRESH_TOKEN_ROTATED' })
  })

  it.each([
    ['SSO_REQUIRED', upstreamError(403, { code: 'SSO_REQUIRED' }), 'SSO_REQUIRED'],
    ['sso_enforced', upstreamError(401, { code: 'SESSION_REVOKED', params: { reason: 'sso_enforced' } }), 'SSO_REQUIRED'],
    ['a plain revocation', upstreamError(401, { code: 'SESSION_REVOKED' }), undefined],
  ])('/api/auth/session clears the cookies and forwards %s', async (_label, err, code) => {
    vi.spyOn(axios, 'post').mockRejectedValue(err)
    const res = await sessionRoute(request('/api/auth/session', 'GET'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual(code ? { error: 'unauthorized', code } : { error: 'unauthorized' })
    expect(res.cookies.get('sid')?.value).toBe('')
  })
})
