// @vitest-environment node
/** Happy / transient / race paths of the cookie proxy routes (reason forwarding lives in auth-cookie-routes.test.ts). */
import { describe, it, expect, vi, afterEach } from 'vitest'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { NextRequest } from 'next/server'
import { POST as refreshRoute } from '@/app/api/auth/refresh/route'
import { GET as sessionRoute } from '@/app/api/auth/session/route'
import { POST as setCookieRoute } from '@/app/api/auth/set-cookie/route'
import { POST as clearCookieRoute } from '@/app/api/auth/clear-cookie/route'

vi.mock('@/lib/config/env', () => ({ serverAuthUrl: () => 'http://auth.test' }))

function upstreamError(status: number, data: unknown = {}) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}
const networkError = () => new axios.AxiosError('timeout', 'ECONNABORTED')
const ok = <T,>(data: T) => ({ data }) as AxiosResponse<T>
const req = (path: string, method: 'GET' | 'POST', cookie?: string, body?: unknown) =>
  new NextRequest(`http://web.test${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

afterEach(() => vi.restoreAllMocks())

describe('/api/auth/refresh', () => {
  it('401 no_refresh without sid / refresh token, never calling upstream', async () => {
    const post = vi.spyOn(axios, 'post')
    const res = await refreshRoute(req('/api/auth/refresh', 'POST', 'sid=s1'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'no_refresh' })
    expect(post).not.toHaveBeenCalled()
  })

  it('success sets access, rotated refresh and slides sid', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue(ok({ accessToken: 'a2', refreshToken: 'r2' }))
    const res = await refreshRoute(req('/api/auth/refresh', 'POST', 'sid=s1; refreshToken=r1'))
    expect(post).toHaveBeenCalledWith('http://auth.test/auth/refresh', { sid: 's1', refreshToken: 'r1' }, expect.any(Object))
    expect(await res.json()).toEqual({ accessToken: 'a2' })
    expect(res.cookies.get('accessToken')).toMatchObject({ value: 'a2', maxAge: 900, httpOnly: true })
    expect(res.cookies.get('refreshToken')).toMatchObject({ value: 'r2', maxAge: 2592000 })
    expect(res.cookies.get('sid')).toMatchObject({ value: 's1', maxAge: 2592000 })
  })

  it('success without a rotated token leaves the refresh cookie alone', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue(ok({ accessToken: 'a2' }))
    const res = await refreshRoute(req('/api/auth/refresh', 'POST', 'sid=s1; refreshToken=r1'))
    expect(res.cookies.get('refreshToken')).toBeUndefined()
  })

  it.each([['network', networkError()], ['5xx', upstreamError(502)], ['429', upstreamError(429)]])(
    '%s failure → 503 transient', async (_l, err) => {
      vi.spyOn(axios, 'post').mockRejectedValue(err)
      const res = await refreshRoute(req('/api/auth/refresh', 'POST', 'sid=s1; refreshToken=r1'))
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'transient' })
    })
})

describe('/api/auth/session', () => {
  const signedIn = 'accessToken=a1; sid=s1; refreshToken=r1'

  it('no access token and no refresh credentials → 401 and cookies cleared', async () => {
    const res = await sessionRoute(req('/api/auth/session', 'GET'))
    expect(res.status).toBe(401)
    expect(res.cookies.get('accessToken')?.value).toBe('')
  })

  it('valid access token → user (id from _id) and refreshed access cookie', async () => {
    const get = vi.spyOn(axios, 'get').mockResolvedValue(ok({ _id: 'u1', email: 'a@b.c' }))
    const res = await sessionRoute(req('/api/auth/session', 'GET', signedIn))
    expect(get).toHaveBeenCalledWith('http://auth.test/api/users/me', { headers: { Authorization: 'Bearer a1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ user: { _id: 'u1', id: 'u1', email: 'a@b.c' }, accessToken: 'a1' })
    expect(res.cookies.get('accessToken')).toMatchObject({ value: 'a1', maxAge: 900 })
    expect(res.cookies.get('refreshToken')).toBeUndefined()
  })

  it('no access token: refreshes first and persists the rotated refresh token + sid', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue(ok({ accessToken: 'a2', refreshToken: 'r2' }))
    vi.spyOn(axios, 'get').mockResolvedValue(ok({ id: 'u1' }))
    const res = await sessionRoute(req('/api/auth/session', 'GET', 'sid=s1; refreshToken=r1'))
    expect(await res.json()).toEqual({ user: { id: 'u1' }, accessToken: 'a2' })
    expect(res.cookies.get('refreshToken')?.value).toBe('r2')
    expect(res.cookies.get('sid')?.value).toBe('s1')
  })

  it('initial refresh: transient error → 503 keeping cookies; rotated race → 401 race_lost', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(networkError())
    let res = await sessionRoute(req('/api/auth/session', 'GET', 'sid=s1; refreshToken=r1'))
    expect(res.status).toBe(503)
    expect(res.cookies.get('sid')).toBeUndefined()
    vi.spyOn(axios, 'post').mockRejectedValueOnce(upstreamError(401, { code: 'REFRESH_TOKEN_ROTATED' }))
    res = await sessionRoute(req('/api/auth/session', 'GET', 'sid=s1; refreshToken=r1'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'race_lost', code: 'REFRESH_TOKEN_ROTATED' })
    expect(res.cookies.get('sid')).toBeUndefined()
  })

  it('/users/me transient failure → 503 without touching cookies', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(upstreamError(500))
    const res = await sessionRoute(req('/api/auth/session', 'GET', signedIn))
    expect(res.status).toBe(503)
    expect(res.cookies.getAll()).toEqual([])
  })

  it('/users/me 401 → refresh-on-401 and retry with the new token', async () => {
    vi.spyOn(axios, 'get')
      .mockRejectedValueOnce(upstreamError(401))
      .mockResolvedValueOnce(ok({ id: 'u1' }))
    vi.spyOn(axios, 'post').mockResolvedValue(ok({ accessToken: 'a2', refreshToken: 'r2' }))
    const res = await sessionRoute(req('/api/auth/session', 'GET', signedIn))
    expect(await res.json()).toEqual({ user: { id: 'u1' }, accessToken: 'a2' })
    expect(res.cookies.get('accessToken')?.value).toBe('a2')
    expect(res.cookies.get('refreshToken')?.value).toBe('r2')
  })

  it('refresh-on-401 then empty user → dead session', async () => {
    vi.spyOn(axios, 'get').mockRejectedValueOnce(upstreamError(401)).mockResolvedValueOnce(ok(''))
    vi.spyOn(axios, 'post').mockResolvedValue(ok({ accessToken: 'a2' }))
    const res = await sessionRoute(req('/api/auth/session', 'GET', signedIn))
    expect(res.status).toBe(401)
    expect(res.cookies.get('sid')?.value).toBe('')
  })

  it('refresh-on-401 then /users/me transient → 503 persisting the rotated credentials', async () => {
    vi.spyOn(axios, 'get').mockRejectedValueOnce(upstreamError(401)).mockRejectedValueOnce(networkError())
    vi.spyOn(axios, 'post').mockResolvedValue(ok({ accessToken: 'a2', refreshToken: 'r2' }))
    const res = await sessionRoute(req('/api/auth/session', 'GET', signedIn))
    expect(res.status).toBe(503)
    expect(res.cookies.get('accessToken')?.value).toBe('a2')
    expect(res.cookies.get('refreshToken')?.value).toBe('r2')
    expect(res.cookies.get('sid')?.value).toBe('s1')
  })

  it('first refresh then /users/me 401 does not replay the superseded refresh token', async () => {
    const post = vi.spyOn(axios, 'post').mockResolvedValue(ok({ accessToken: 'a2', refreshToken: 'r2' }))
    vi.spyOn(axios, 'get').mockRejectedValue(upstreamError(401))
    const res = await sessionRoute(req('/api/auth/session', 'GET', 'sid=s1; refreshToken=r1'))
    expect(post).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(401)
    expect(res.cookies.get('refreshToken')?.value).toBe('')
  })

  it('/users/me 403 with only an access token (no refresh creds) clears the session', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(upstreamError(403, { code: 'ACCOUNT_BLOCKED' }))
    const res = await sessionRoute(req('/api/auth/session', 'GET', 'accessToken=a1'))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized', code: 'ACCOUNT_BLOCKED' })
  })
})

describe('/api/auth/set-cookie and clear-cookie', () => {
  it('set-cookie writes the three httpOnly cookies with their lifetimes', async () => {
    const res = await setCookieRoute(req('/api/auth/set-cookie', 'POST', undefined, { accessToken: 'a', refreshToken: 'r', sid: 's' }))
    expect(await res.json()).toEqual({ ok: true })
    expect(res.cookies.get('accessToken')).toMatchObject({ value: 'a', maxAge: 900, httpOnly: true, sameSite: 'lax', path: '/' })
    expect(res.cookies.get('refreshToken')).toMatchObject({ value: 'r', maxAge: 2592000 })
    expect(res.cookies.get('sid')).toMatchObject({ value: 's', maxAge: 2592000 })
  })

  it('clear-cookie expires all three', async () => {
    const res = await clearCookieRoute()
    expect(await res.json()).toEqual({ ok: true })
    for (const n of ['accessToken', 'refreshToken', 'sid']) {
      expect(res.cookies.get(n)).toMatchObject({ value: '', maxAge: 0, path: '/' })
    }
  })
})
