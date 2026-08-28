import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SUPPORTED_LOCALES, LOCALE_NAMES, DEFAULT_LOCALE } from '@/i18n/config'

/**
 * Structural guard for the message catalogues.
 *
 * A locale that silently misses a key falls back to English at runtime, so nothing crashes and
 * nothing is logged — the gap only shows up when a user in that language hits the screen. A
 * placeholder mismatch is worse: next-intl throws when a message references a variable the
 * caller never passed. Both are cheap to assert and impossible to notice by reading diffs.
 */

const MESSAGES_DIR = path.join(__dirname, '../../messages')

type Json = Record<string, unknown>

function flatten(obj: Json, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Json, key))
    } else {
      out[key] = String(v)
    }
  }
  return out
}

function load(locale: string): Record<string, string> {
  return flatten(JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8')))
}

/**
 * Variable names referenced by an ICU message: `{name}`, `{count, plural, …}`.
 *
 * The name must start with a letter or underscore so an explicit-value plural branch
 * (`=1{1 participant}`) is not mistaken for a placeholder called `1`.
 */
function placeholders(message: string): string[] {
  return [...new Set([...message.matchAll(/\{\s*([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))].sort()
}

const en = load(DEFAULT_LOCALE)
const others = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE)

describe('i18n catalogue parity', () => {
  it('ships a message file for every supported locale, each with a native name', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(fs.existsSync(path.join(MESSAGES_DIR, `${locale}.json`)), `${locale}.json`).toBe(true)
      expect(LOCALE_NAMES[locale], `native name for ${locale}`).toBeTruthy()
    }
  })

  it('has no message files for unsupported locales', () => {
    const onDisk = fs
      .readdirSync(MESSAGES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
      .sort()
    expect(onDisk).toEqual([...SUPPORTED_LOCALES].sort())
  })

  it.each(others)('%s defines exactly the keys en defines', (locale) => {
    const target = load(locale)
    expect(Object.keys(target).filter((k) => !(k in en)).sort()).toEqual([])
    expect(Object.keys(en).filter((k) => !(k in target)).sort()).toEqual([])
  })

  it.each(others)('%s uses the same ICU placeholders as en', (locale) => {
    const target = load(locale)
    const mismatched = Object.keys(en)
      .filter((k) => k in target)
      .filter((k) => placeholders(en[k]).join() !== placeholders(target[k]).join())
      .map((k) => `${k}: en=${placeholders(en[k])} ${locale}=${placeholders(target[k])}`)
    expect(mismatched).toEqual([])
  })

  it.each(SUPPORTED_LOCALES)('%s has no blank messages', (locale) => {
    const target = load(locale)
    expect(Object.keys(target).filter((k) => target[k].trim() === '')).toEqual([])
  })

  it.each(SUPPORTED_LOCALES)('%s keeps the "other" branch on every plural', (locale) => {
    const target = load(locale)
    const broken = Object.keys(target).filter(
      (k) => /,\s*plural\s*,/.test(target[k]) && !/(^|\s)other\s*\{/.test(target[k]),
    )
    expect(broken).toEqual([])
  })
})
