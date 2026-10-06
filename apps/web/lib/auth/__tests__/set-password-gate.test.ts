import { describe, it, expect } from 'vitest'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  SET_PASSWORD_PATH,
  isSetPasswordPath,
  mustSetPassword,
  postSignInPath,
  setPasswordRedirect,
} from '@/lib/auth/set-password-gate'
import { authCodeToI18nKey, parseAuthError } from '@/lib/auth/auth-error'

const flagged = { mustSetPassword: true }
const cleared = { mustSetPassword: false }
const legacy = {} // older server / legacy account: field absent

describe('set-password gate', () => {
  it('only an explicit true flag gates the user', () => {
    expect(mustSetPassword(flagged)).toBe(true)
    expect(mustSetPassword(cleared)).toBe(false)
    expect(mustSetPassword(legacy)).toBe(false)
    expect(mustSetPassword(null)).toBe(false)
    expect(mustSetPassword(undefined)).toBe(false)
  })

  it('recognises the set-password route only', () => {
    expect(isSetPasswordPath('/set-password')).toBe(true)
    expect(isSetPasswordPath('/set-password/')).toBe(true)
    expect(isSetPasswordPath('/set-passwordx')).toBe(false)
    expect(isSetPasswordPath('/settings/security')).toBe(false)
  })

  it.each(['/', '/conversations', '/conversations/abc', '/settings', '/settings/security', '/admin/members'])(
    'sends a flagged user from %s to /set-password',
    (pathname) => {
      expect(setPasswordRedirect(pathname, flagged)).toBe(SET_PASSWORD_PATH)
    },
  )

  it('keeps a flagged user on /set-password', () => {
    expect(setPasswordRedirect('/set-password', flagged)).toBeNull()
  })

  it('sends an unflagged user away from /set-password to /', () => {
    expect(setPasswordRedirect('/set-password', cleared)).toBe('/')
    expect(setPasswordRedirect('/set-password', legacy)).toBe('/')
  })

  it('never touches an unflagged user anywhere else', () => {
    expect(setPasswordRedirect('/conversations', cleared)).toBeNull()
    expect(setPasswordRedirect('/settings/security', legacy)).toBeNull()
  })

  it('leaves the signed-out redirect to the session layer (keeps /login?reason=)', () => {
    expect(setPasswordRedirect('/set-password', null)).toBeNull()
    expect(setPasswordRedirect('/conversations', null)).toBeNull()
  })

  it('lands a flagged user straight on /set-password after sign-in', () => {
    expect(postSignInPath(flagged)).toBe('/set-password')
    expect(postSignInPath(cleared)).toBe('/')
    expect(postSignInPath(legacy)).toBe('/')
  })
})

function errWith(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

describe('change-password error codes', () => {
  it.each([
    ['CURRENT_PASSWORD_REQUIRED', 'errCurrentPasswordRequired'],
    ['CURRENT_PASSWORD_INCORRECT', 'errCurrentPasswordIncorrect'],
    ['VAL_PASSWORD_TOO_SHORT', 'errValPasswordTooShort'],
    ['USER_NOT_FOUND', 'errUserNotFound'],
  ])('maps %s to auth.%s', (code, key) => {
    expect(authCodeToI18nKey(code)).toBe(key)
  })

  it('reads the code from a top-level body and from a validation array', () => {
    expect(parseAuthError(errWith(400, { code: 'CURRENT_PASSWORD_INCORRECT' })).code).toBe(
      'CURRENT_PASSWORD_INCORRECT',
    )
    expect(parseAuthError(errWith(400, { message: ['VAL_PASSWORD_TOO_SHORT'] })).code).toBe(
      'VAL_PASSWORD_TOO_SHORT',
    )
  })

  it('never turns raw server text into a code', () => {
    expect(parseAuthError(errWith(409, { message: 'Incorrect current password' })).code).toBe('GENERIC_ERROR')
  })
})
