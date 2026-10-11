import { describe, expect, it } from 'vitest'
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { callErrorNotice } from '../call-errors'
import { isErrorNotice } from '../call-end-notice'

function httpErr(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

describe('callErrorNotice', () => {
  it('maps every call REST code to its own message', () => {
    expect(callErrorNotice(httpErr(503, { error: 'x', code: 'CALLS_UNAVAILABLE', statusCode: 503 }))).toBe(
      'errUnavailable',
    )
    expect(callErrorNotice(httpErr(404, { code: 'CALL_NOT_FOUND' }))).toBe('errNotFound')
    expect(callErrorNotice(httpErr(409, { code: 'CALL_ENDED' }))).toBe('errEnded')
    expect(callErrorNotice(httpErr(409, { code: 'CALL_NOT_SFU' }))).toBe('errNotSfu')
    expect(callErrorNotice(httpErr(403, { code: 'CALL_FORBIDDEN' }))).toBe('errForbidden')
  })

  it('a bare 503 (proxy, older server) still says calls are unavailable', () => {
    expect(callErrorNotice(httpErr(503, '<html>Service Unavailable</html>'))).toBe('errUnavailable')
  })

  it('no response at all is a network problem', () => {
    const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
    expect(callErrorNotice(new axios.AxiosError('Network Error', 'ERR_NETWORK', config))).toBe('errNetwork')
  })

  it('anything else is the generic failure — never the raw server text', () => {
    expect(callErrorNotice(httpErr(500, { message: 'NullPointerException' }))).toBe('errFailed')
    expect(callErrorNotice(new Error('boom'))).toBe('errFailed')
    expect(callErrorNotice(undefined)).toBe('errFailed')
  })
})

describe('isErrorNotice', () => {
  it('shows failures as error toasts and the rest as plain ones', () => {
    expect(isErrorNotice('errUnavailable')).toBe(true)
    expect(isErrorNotice('errStartTimeout')).toBe(true)
    expect(isErrorNotice('connectionLost')).toBe(true)
    expect(isErrorNotice('mediaError')).toBe(true)
    expect(isErrorNotice('declined')).toBe(false)
    expect(isErrorNotice('noAnswer')).toBe(false)
  })
})
