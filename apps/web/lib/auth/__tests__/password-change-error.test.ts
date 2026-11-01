import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import { passwordChangeErrorKey } from '@/lib/auth/password-change-error'

/**
 * The helper returns a bare key that both callers resolve under their own namespace, so a key
 * dropped from either namespace is invisible to the type checker and to the parity test (every
 * locale misses it equally). next-intl then throws MISSING_MESSAGE in dev and renders the raw
 * key in production — this pins every key the helper can return to both catalogues.
 */

const MESSAGES_DIR = path.join(__dirname, '../../../messages')
const NAMESPACES = ['security', 'changePasswordDialog'] as const

const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig

function httpErr(status: number, data: unknown) {
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

// One input per branch of passwordChangeErrorKey, legacy message fallbacks included.
const BRANCHES: Array<[string, unknown]> = [
  ['not an axios error', new Error('boom')],
  ['no response', new axios.AxiosError('Network Error', 'ERR_NETWORK', config)],
  ['CURRENT_PASSWORD_INCORRECT', httpErr(400, { code: 'CURRENT_PASSWORD_INCORRECT' })],
  ['legacy incorrect message', httpErr(400, { message: 'Incorrect current password' })],
  ['CURRENT_PASSWORD_REQUIRED', httpErr(400, { code: 'CURRENT_PASSWORD_REQUIRED' })],
  ['legacy required message', httpErr(400, { message: 'Current password is required' })],
  ['VAL_PASSWORD_TOO_SHORT', httpErr(400, { code: 'VAL_PASSWORD_TOO_SHORT', params: { min: 10 } })],
  ['legacy too-short message', httpErr(400, { message: 'Password must be at least 8 characters' })],
  ['unknown code', httpErr(500, { code: 'SOMETHING_NEW' })],
]

const results = BRANCHES.map(([, err]) => passwordChangeErrorKey(err))

function loadNamespace(locale: string, ns: string): Record<string, unknown> {
  const messages = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'))
  return messages.settings[ns]
}

describe('passwordChangeErrorKey ↔ message catalogues', () => {
  it('the branches above reach every key the helper returns', () => {
    expect([...new Set(results.map((r) => r.key))].sort()).toEqual(
      ['currentRequired', 'genericError', 'incorrectCurrent', 'networkError', 'tooShort'],
    )
  })

  it.each(SUPPORTED_LOCALES.flatMap((l) => NAMESPACES.map((ns) => [l, ns])))(
    '%s settings.%s defines every returned key, with the placeholders it is given',
    (locale, ns) => {
      const catalogue = loadNamespace(locale, ns)
      for (const { key, values } of results) {
        const message = catalogue[key]
        expect(typeof message, `settings.${ns}.${key}`).toBe('string')
        const needed = [...(message as string).matchAll(/\{\s*([A-Za-z_]\w*)/g)].map((m) => m[1])
        expect(needed.filter((v) => !(values && v in values)), `settings.${ns}.${key} placeholders`).toEqual([])
      }
    },
  )
})
