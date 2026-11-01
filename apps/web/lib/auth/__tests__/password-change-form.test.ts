import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SUPPORTED_LOCALES } from '@/i18n/config'
import {
  MIN_PASSWORD_LENGTH,
  passwordChangeErrorField,
  validatePasswordChange,
} from '@/lib/auth/password-change-form'

const MESSAGES_DIR = path.join(__dirname, '../../../messages')
const GOOD = 'Secret#123'

const errorKeys = (form: { current: string; next: string; confirm: string }, needsCurrent = true) =>
  Object.fromEntries(Object.entries(validatePasswordChange(form, needsCurrent)).map(([f, e]) => [f, e?.key]))

describe('validatePasswordChange', () => {
  it('an empty form asks for the current and the new password, not for a match', () => {
    expect(errorKeys({ current: '', next: '', confirm: '' })).toEqual({
      current: 'currentRequired',
      next: 'newRequired',
    })
  })

  it('a first password (no current one) never asks for the current password', () => {
    expect(errorKeys({ current: '', next: GOOD, confirm: GOOD }, false)).toEqual({})
  })

  it('reports the first unmet rule of the new password, as a sentence key', () => {
    expect(validatePasswordChange({ current: 'x', next: 'Ab#1', confirm: 'Ab#1' }, true).next).toEqual({
      key: 'tooShort',
      values: { min: MIN_PASSWORD_LENGTH },
    })
    expect(errorKeys({ current: 'x', next: 'secret#123', confirm: 'secret#123' }).next).toBe('needUppercase')
    expect(errorKeys({ current: 'x', next: 'SECRET#123', confirm: 'SECRET#123' }).next).toBe('needLowercase')
    expect(errorKeys({ current: 'x', next: 'Secret#abc', confirm: 'Secret#abc' }).next).toBe('needDigit')
    expect(errorKeys({ current: 'x', next: 'Secret1234', confirm: 'Secret1234' }).next).toBe('needSpecial')
  })

  it('judges the confirmation once a new password was typed', () => {
    expect(errorKeys({ current: 'x', next: GOOD, confirm: '' })).toEqual({ confirm: 'mismatch' })
    expect(errorKeys({ current: 'x', next: GOOD, confirm: 'Secret#124' })).toEqual({ confirm: 'mismatch' })
    expect(errorKeys({ current: 'x', next: GOOD, confirm: GOOD })).toEqual({})
  })
})

describe('passwordChangeErrorField', () => {
  it('puts server answers about one input under that input', () => {
    expect(passwordChangeErrorField('incorrectCurrent')).toBe('current')
    expect(passwordChangeErrorField('currentRequired')).toBe('current')
    expect(passwordChangeErrorField('tooShort')).toBe('next')
  })

  it('keeps form-wide problems above the form', () => {
    expect(passwordChangeErrorField('networkError')).toBeNull()
    expect(passwordChangeErrorField('genericError')).toBeNull()
  })
})

describe('every field message exists in settings.security', () => {
  const forms = [
    { current: '', next: '', confirm: '' },
    { current: 'x', next: 'Ab#1', confirm: '' },
    { current: 'x', next: 'secret#123', confirm: '' },
    { current: 'x', next: 'SECRET#123', confirm: '' },
    { current: 'x', next: 'Secret#abc', confirm: '' },
    { current: 'x', next: 'Secret1234', confirm: '' },
  ]
  const returned = forms.flatMap((f) => Object.values(validatePasswordChange(f, true)))

  it('the forms above reach every key', () => {
    expect([...new Set(returned.map((e) => e?.key))].sort()).toEqual([
      'currentRequired', 'mismatch', 'needDigit', 'needLowercase', 'needSpecial', 'needUppercase',
      'newRequired', 'tooShort',
    ])
  })

  it.each(SUPPORTED_LOCALES)('%s', (locale) => {
    const messages = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'))
    const security: Record<string, unknown> = messages.settings.security
    // The confirmation the page shows in the card after a success.
    for (const key of ['changeSuccess', 'changeDoneBody', 'setSuccess', 'setDoneBody']) {
      expect(typeof security[key], `settings.security.${key}`).toBe('string')
    }
    for (const e of returned) {
      const message = security[e!.key]
      expect(typeof message, `settings.security.${e!.key}`).toBe('string')
      const needed = [...(message as string).matchAll(/\{\s*([A-Za-z_]\w*)/g)].map((m) => m[1])
      expect(needed.filter((v) => !(e!.values && v in e!.values)), `${e!.key} placeholders`).toEqual([])
    }
  })
})
