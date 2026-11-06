/**
 * authService ↔ auth-service contract for the calls with client-side logic:
 * batch user lookup (dedupe, drop empties, chunks of 100 — the old per-id N+1
 * triggered 429s), department rows sanitised, invitation tokens URL-encoded in
 * the path, 2FA bodies tagged with the web device, logout never throws.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { authApi } from '@/lib/api/axios'
import { authService } from '@/lib/api/auth'

interface Call {
  method: string
  url: string
  data: unknown
  params: Record<string, unknown> | undefined
}
let calls: Call[] = []
let savedAdapter: unknown
let reply: (c: Call) => { status?: number; data: unknown } = () => ({ data: {} })

beforeEach(() => {
  calls = []
  reply = () => ({ data: {} })
  savedAdapter = authApi.defaults.adapter
  authApi.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const call: Call = {
      method: (config.method ?? '').toUpperCase(),
      url: config.url ?? '',
      data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      params: config.params,
    }
    calls.push(call)
    const { status = 200, data } = reply(call)
    const res = { data, status, statusText: '', headers: {}, config } as AxiosResponse
    if (status >= 400) {
      return Promise.reject(Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: res, config }))
    }
    return Promise.resolve(res)
  }
})
afterEach(() => {
  authApi.defaults.adapter = savedAdapter as typeof authApi.defaults.adapter
})

describe('getUsers', () => {
  it('no ids (or only empty ones) → no request', async () => {
    await expect(authService.getUsers([])).resolves.toEqual([])
    await expect(authService.getUsers(['', ''])).resolves.toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('dedupes and sends one comma-joined batch', async () => {
    reply = (c) => ({ data: String(c.params?.ids).split(',').map((id) => ({ id })) })
    const users = await authService.getUsers(['a', 'b', 'a', '', 'c'])
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/users')
    expect(calls[0].params).toEqual({ ids: 'a,b,c' })
    expect(users.map((u) => u.id)).toEqual(['a', 'b', 'c'])
  })

  it('splits 250 ids into 100 / 100 / 50 and merges in order', async () => {
    reply = (c) => ({ data: String(c.params?.ids).split(',').map((id) => ({ id })) })
    const ids = Array.from({ length: 250 }, (_, i) => `u${i}`)
    const users = await authService.getUsers(ids)
    expect(calls.map((c) => String(c.params?.ids).split(',').length)).toEqual([100, 100, 50])
    expect(users.map((u) => u.id)).toEqual(ids)
  })
})

describe('getMyDepartments', () => {
  it('keeps only well-formed {id, name} rows', async () => {
    reply = () => ({
      data: [
        { id: 'd1', name: 'Eng' },
        null,
        'x',
        { id: 2, name: 'Bad id' },
        { id: 'd3' },
        { id: 'd4', name: 'Ops', extra: true },
      ],
    })
    await expect(authService.getMyDepartments()).resolves.toEqual([
      { id: 'd1', name: 'Eng' },
      { id: 'd4', name: 'Ops', extra: true },
    ])
  })

  it('a non-array body reads as no departments', async () => {
    reply = () => ({ data: { error: 'nope' } })
    await expect(authService.getMyDepartments()).resolves.toEqual([])
  })
})

describe('invitations', () => {
  it('URL-encodes the raw token into the path', async () => {
    const token = 'a/b?c=d&e#f'
    await authService.getInvitation(token)
    await authService.acceptInvitation(token, 'Ann', 'pw')
    expect(calls[0].url).toBe(`/auth/invitations/${encodeURIComponent(token)}`)
    expect(calls[1].url).toBe(`/auth/invitations/${encodeURIComponent(token)}/accept-password`)
    expect(calls[1].data).toEqual({ displayName: 'Ann', password: 'pw', deviceId: 'web', platform: 'web' })
    expect(calls.every((c) => !c.url.includes('?'))).toBe(true)
  })
})

describe('two-factor', () => {
  it('verify and enroll-complete carry the web device; proofs are spread as-is', async () => {
    await authService.mfaVerify('mt', { code: '123456' })
    await authService.mfaVerify('mt', { backupCode: 'ABCD-EFGH' })
    await authService.mfaEnrollComplete('mt')
    expect(calls.map((c) => [c.url, c.data])).toEqual([
      ['/auth/mfa/verify', { mfaToken: 'mt', code: '123456', deviceId: 'web', platform: 'web' }],
      ['/auth/mfa/verify', { mfaToken: 'mt', backupCode: 'ABCD-EFGH', deviceId: 'web', platform: 'web' }],
      ['/auth/mfa/enroll/complete', { mfaToken: 'mt', deviceId: 'web', platform: 'web' }],
    ])
  })

  it('enrollment + self-service endpoints', async () => {
    await authService.mfaEnrollStart('mt')
    await authService.mfaEnrollConfirm('mt', '111111')
    await authService.mfaEnrollCodes('mt')
    await authService.regenerateBackupCodes('222222')
    await authService.selfMfaEnrollStart()
    await authService.selfMfaEnrollConfirm('333333')
    await authService.selfMfaDisable({ backupCode: 'X' })
    expect(calls.map((c) => [c.method, c.url, c.data ?? null])).toEqual([
      ['POST', '/auth/mfa/enroll/start', { mfaToken: 'mt' }],
      ['POST', '/auth/mfa/enroll/confirm', { mfaToken: 'mt', code: '111111' }],
      ['POST', '/auth/mfa/enroll/codes', { mfaToken: 'mt' }],
      ['POST', '/api/users/me/mfa/backup-codes', { code: '222222' }],
      ['POST', '/api/users/me/mfa/enroll/start', null],
      ['POST', '/api/users/me/mfa/enroll/confirm', { code: '333333' }],
      ['POST', '/api/users/me/mfa/disable', { backupCode: 'X' }],
    ])
  })
})

describe('session + account', () => {
  it('logout swallows a server error (the local logout must still proceed)', async () => {
    reply = () => ({ status: 500, data: {} })
    await expect(authService.logout()).resolves.toBeUndefined()
    expect(calls[0].url).toBe('/auth/logout')
  })

  it('exchangeCode defaults the device to web', async () => {
    await authService.exchangeCode('c0de')
    await authService.exchangeCode('c0de', 'dev-1')
    expect(calls.map((c) => c.data)).toEqual([
      { code: 'c0de', deviceId: 'web', platform: 'web' },
      { code: 'c0de', deviceId: 'dev-1', platform: 'web' },
    ])
  })

  it('OTP / password / profile endpoints', async () => {
    await authService.login('a@b.c', 'pw')
    await authService.verifyOtp('a@b.c', '123456')
    await authService.resendOtp('a@b.c')
    await authService.forgotPassword('a@b.c')
    await authService.resetPassword('a@b.c', '123456', 'new')
    await authService.changePassword(undefined, 'new')
    await authService.updateProfile({ phoneNumber: null })
    await authService.verifyFirebasePhoneToken('fb')
    await authService.blockUser('u2')
    await authService.unblockUser('u2')
    expect(calls.map((c) => [c.method, c.url, c.data ?? null])).toEqual([
      ['POST', '/auth/login', { email: 'a@b.c', password: 'pw' }],
      ['POST', '/auth/verify-otp', { email: 'a@b.c', otp: '123456' }],
      ['POST', '/auth/resend-otp', { email: 'a@b.c' }],
      ['POST', '/auth/forgot-password', { email: 'a@b.c' }],
      ['POST', '/auth/reset-password', { email: 'a@b.c', otp: '123456', password: 'new' }],
      ['POST', '/api/users/me/change-password', { newPassword: 'new' }],
      ['PATCH', '/api/users/me', { phoneNumber: null }],
      ['POST', '/api/users/me/phone/verify', { firebaseIdToken: 'fb' }],
      ['POST', '/api/users/block/u2', null],
      ['POST', '/api/users/unblock/u2', null],
    ])
  })

  it('read endpoints', async () => {
    await authService.getSsoInfo()
    await authService.searchUsers('ann')
    await authService.getMe()
    await authService.getOnlineFriends()
    await authService.getRelationship('u2')
    await authService.getUser('u2')
    expect(calls.map((c) => [c.url, c.params ?? null])).toEqual([
      ['/auth/sso/info', null],
      ['/api/users/search', { q: 'ann' }],
      ['/api/users/me', null],
      ['/api/users/friends/online', null],
      ['/api/users/u2/relationship', null],
      ['/api/users/u2', null],
    ])
  })
})
