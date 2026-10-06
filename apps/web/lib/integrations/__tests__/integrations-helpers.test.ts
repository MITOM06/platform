import { describe, it, expect } from 'vitest'
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import {
  connectorErrorKey,
  oauthCallbackErrorKey,
  parseOAuthReturn,
} from '@/lib/integrations/connector-errors'
import { canConnect, canDisconnect, connectCapability, connectionState } from '@/lib/integrations/gating'
import { authModeLabelKey, scopeLabelKeys } from '@/lib/integrations/labels'
import { passwordChangeErrorKey } from '@/lib/auth/password-change-error'
import { isLoginNotice } from '@/lib/auth/force-logout'
import { quotaResetDate, quotaView, utcMonthLabel, utcMonthOptions } from '@/lib/usage/quota'

function httpErr(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

describe('OAuth return handling', () => {
  it('parses ?connected= and ?error=&provider=', () => {
    expect(parseOAuthReturn('?connected=gmail')).toEqual({ connected: 'gmail' })
    expect(parseOAuthReturn('?error=ACCESS_DENIED&provider=notion')).toEqual({
      error: 'ACCESS_DENIED',
      provider: 'notion',
    })
    expect(parseOAuthReturn('?foo=1')).toBeNull()
  })

  it('never echoes arbitrary values', () => {
    expect(parseOAuthReturn('?error=<script>&provider=%3Cb%3E')).toEqual({ error: 'INTERNAL_ERROR' })
    expect(parseOAuthReturn('?connected=%3Cx%3E')).toBeNull()
  })

  it('has a localized message for every callback code', () => {
    const codes = [
      'ACCESS_DENIED', 'PROVIDER_ERROR', 'MISSING_CODE', 'STATE_INVALID', 'STATE_EXPIRED',
      'CONNECTOR_UNAVAILABLE', 'CONNECTOR_NOT_ALLOWED', 'INSUFFICIENT_PERMISSION',
      'EXCHANGE_FAILED', 'INTERNAL_ERROR',
    ]
    const keys = codes.map(oauthCallbackErrorKey)
    expect(new Set(keys).size).toBe(codes.length)
    expect(oauthCallbackErrorKey('NEW_CODE')).toBe('oauthErrInternal')
  })

  it('maps REST errors by code', () => {
    expect(connectorErrorKey(httpErr(400, { code: 'UNSAFE_URL', reason: 'x' }), 'f')).toBe('errUnsafeUrl')
    expect(connectorErrorKey(httpErr(403, { code: 'CONNECTOR_NOT_ALLOWED' }), 'f')).toBe('errConnectorNotAllowed')
    expect(connectorErrorKey(httpErr(403, {}), 'f')).toBe('errInsufficientPermission')
    expect(connectorErrorKey(httpErr(500, { message: 'boom' }), 'f')).toBe('f')
  })
})

describe('connector gating', () => {
  it('connect needs the tier capability', () => {
    expect(connectCapability('workspace')).toBe('CONNECT_WORKSPACE_CONNECTOR')
    expect(connectCapability('both')).toBe('CONNECT_PERSONAL_CONNECTOR')
    expect(canConnect('personal', ['CONNECT_PERSONAL_CONNECTOR'])).toBe(true)
    expect(canConnect('workspace', ['CONNECT_PERSONAL_CONNECTOR'])).toBe(false)
    expect(canConnect(undefined, undefined)).toBe(false)
  })

  it('workspace connections need CONNECT_WORKSPACE_CONNECTOR to disconnect', () => {
    expect(canDisconnect({ scope: 'personal' }, [])).toBe(true)
    expect(canDisconnect({ scope: 'workspace' }, [])).toBe(false)
    expect(canDisconnect({ scope: 'workspace' }, ['CONNECT_WORKSPACE_CONNECTOR'])).toBe(true)
  })

  it('expired connections ask for a reconnect', () => {
    expect(connectionState({ status: 'active' })).toBe('connected')
    expect(connectionState({ status: 'expired' })).toBe('expired')
    expect(connectionState({ status: 'revoked' })).toBe('none')
    expect(connectionState(undefined)).toBe('none')
  })

  it('scopes and auth modes get labels, never raw URLs / slugs', () => {
    expect(
      scopeLabelKeys([
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://example.com/unknown',
      ]),
    ).toEqual(['scopeSendEmail', 'scopeReadEmail'])
    expect(authModeLabelKey('env-oauth')).toBe('authModeOauth')
    expect(authModeLabelKey('???')).toBe('authModeOther')
  })
})

describe('password change errors (by code)', () => {
  it('maps the contract codes', () => {
    expect(passwordChangeErrorKey(httpErr(409, { code: 'CURRENT_PASSWORD_REQUIRED' }))).toEqual({ key: 'currentRequired' })
    expect(passwordChangeErrorKey(httpErr(409, { code: 'CURRENT_PASSWORD_INCORRECT' }))).toEqual({ key: 'incorrectCurrent' })
    expect(passwordChangeErrorKey(httpErr(409, { code: 'VAL_PASSWORD_TOO_SHORT', params: { min: 8 } }))).toEqual({
      key: 'tooShort',
      values: { min: 8 },
    })
    expect(passwordChangeErrorKey(httpErr(500, { message: 'x' }))).toEqual({ key: 'genericError' })
  })

  it('SSO error redirects become login notices', () => {
    expect(isLoginNotice('SSO_EMAIL_UNVERIFIED')).toBe(true)
    expect(isLoginNotice('SOCIAL_ACCOUNT_CONFLICT')).toBe(true)
  })
})

describe('quota + UTC months', () => {
  it('reads limit 0 as blocked and used >= limit as exceeded', () => {
    expect(quotaView({ used: 10, limit: 0 })).toMatchObject({ blocked: true, exceeded: true })
    expect(quotaView({ used: 250, limit: 1000 })).toMatchObject({ percent: '25.0', exceeded: false })
    expect(quotaView({ used: 1000, limit: 1000 })).toMatchObject({ exceeded: true, fraction: 1 })
  })

  it('builds months in UTC (no local-time drift on the 1st)', () => {
    // 00:30 UTC on Oct 1 is still Sep 30 west of UTC — the list must start at October.
    expect(utcMonthOptions(new Date('2026-10-01T00:30:00Z'), 3)).toEqual(['2026-10', '2026-09', '2026-08'])
    expect(utcMonthOptions(new Date('2026-01-15T12:00:00Z'), 2)).toEqual(['2026-01', '2025-12'])
    expect(utcMonthLabel('2026-10', 'en')).toBe('October 2026')
    expect(quotaResetDate('2026-11-01T00:00:00.000Z', 'en')).toContain('2026')
  })
})
