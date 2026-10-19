import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { connectorErrorKey } from '../connector-errors'

function restError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: {} as never,
    data,
  })
}

describe('connectorErrorKey', () => {
  // `/oauth/:provider/start` answers a connector whose OAuth client id/secret
  // is unset with this code; it must reach the member as the localized
  // "not set up on the server" sentence, never as the generic failure.
  it('maps CONNECTOR_NOT_CONFIGURED to the not-set-up message', () => {
    const err = restError(400, { code: 'CONNECTOR_NOT_CONFIGURED', provider: 'notion' })
    expect(connectorErrorKey(err, 'connectError')).toBe('errEnvOauthNotConfigured')
  })

  it('keeps the directory code on the same message', () => {
    const err = restError(400, { code: 'ENV_OAUTH_NOT_CONFIGURED' })
    expect(connectorErrorKey(err, 'connectError')).toBe('errEnvOauthNotConfigured')
  })

  it('falls back for a code it does not know', () => {
    expect(connectorErrorKey(restError(400, { code: 'SOMETHING_ELSE' }), 'connectError')).toBe(
      'connectError',
    )
  })
})
