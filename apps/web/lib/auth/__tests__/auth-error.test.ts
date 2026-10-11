import { describe, expect, it } from 'vitest'
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { authCodeToI18nKey, parseAuthError } from '@/lib/auth/auth-error'

const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig

function httpErr(status: number, data: unknown) {
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

describe('parseAuthError: failures without a business code', () => {
  it('a throttled request (429 from the rate limiter) is "too many requests"', () => {
    const throttled = httpErr(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' })
    expect(parseAuthError(throttled).code).toBe('TOO_MANY_REQUESTS')
    expect(authCodeToI18nKey('TOO_MANY_REQUESTS')).toBe('errTooManyRequests')
  })

  it('a 429 that carries its own code keeps it', () => {
    const cooldown = httpErr(429, { code: 'INVITATION_RESEND_COOLDOWN', params: { ttl: 30 } })
    expect(parseAuthError(cooldown)).toEqual({ code: 'INVITATION_RESEND_COOLDOWN', params: { ttl: 30 } })
  })

  it('no response at all (offline, DNS, server down) is a network problem', () => {
    const offline = new axios.AxiosError('Network Error', 'ERR_NETWORK', config)
    expect(parseAuthError(offline).code).toBe('NETWORK_ERROR')
    expect(authCodeToI18nKey('NETWORK_ERROR')).toBe('errNetwork')
  })

  it('anything else unknown stays generic', () => {
    expect(parseAuthError(httpErr(500, { message: 'boom' })).code).toBe('GENERIC_ERROR')
    expect(parseAuthError(new Error('boom')).code).toBe('GENERIC_ERROR')
    expect(parseAuthError(undefined).code).toBe('GENERIC_ERROR')
  })

  it('business codes still win', () => {
    expect(parseAuthError(httpErr(401, { code: 'LOGIN_FAILED_WITH_REMAINING', params: { remaining: 2 } }))).toEqual({
      code: 'LOGIN_FAILED_WITH_REMAINING',
      params: { remaining: 2 },
    })
  })
})
