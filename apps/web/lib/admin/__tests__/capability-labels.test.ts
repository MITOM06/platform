import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { CAPABILITIES } from '@/lib/api/admin-types'
import { SUPPORTED_LOCALES } from '@/i18n/config'

const MESSAGES_DIR = path.join(__dirname, '../../../messages')

function caps(locale: string): Record<string, string> {
  const json = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), 'utf8'))
  return json.admin.caps as Record<string, string>
}

describe('capability labels', () => {
  it('lists HOST_MEETING last, after the AI-context capabilities', () => {
    expect(CAPABILITIES[CAPABILITIES.length - 1]).toBe('HOST_MEETING')
  })

  it.each(SUPPORTED_LOCALES)('%s labels every capability with real text, never the code', (locale) => {
    const labels = caps(locale)
    for (const cap of CAPABILITIES) {
      expect(labels[cap], `${locale} admin.caps.${cap}`).toBeTruthy()
      expect(labels[cap]).not.toBe(cap)
    }
  })
})
