import { describe, it, expect } from 'vitest'
import { createTranslator } from 'next-intl'
import en from '@/messages/en.json'
import es from '@/messages/es.json'
import fr from '@/messages/fr.json'
import ja from '@/messages/ja.json'
import ko from '@/messages/ko.json'
import vi from '@/messages/vi.json'
import zh from '@/messages/zh.json'

const LOCALES = { en, es, fr, ja, ko, vi, zh }

/** The real ICU strings of all 7 locales (the section tests mock `next-intl`). */
describe.each(Object.entries(LOCALES))('backup codes left copy: %s', (locale, messages) => {
  const t = createTranslator({ locale, messages, namespace: 'settings.security' })

  it('shows the number for 0, 1, 2, 3 and 10, with no raw ICU left over', () => {
    for (const count of [0, 1, 2, 3, 10]) {
      const text = t('backupCodesLeft', { count })
      expect(text).toContain(String(count))
      expect(text).not.toMatch(/[{}#]|plural/)
    }
  })

  it('the warning names the Regenerate button by its exact label', () => {
    const action = t('regenerateButton')
    const text = t('backupCodesLow', { action })
    expect(text).toContain(action)
    expect(text).not.toMatch(/[{}]/)
  })
})

describe('backup codes left copy: plural forms', () => {
  it('English and French agree with the number', () => {
    const tEn = createTranslator({ locale: 'en', messages: en, namespace: 'settings.security' })
    expect(tEn('backupCodesLeft', { count: 1 })).toBe('1 backup code left')
    expect(tEn('backupCodesLeft', { count: 2 })).toBe('2 backup codes left')
    const tFr = createTranslator({ locale: 'fr', messages: fr, namespace: 'settings.security' })
    expect(tFr('backupCodesLeft', { count: 1 })).toBe('1 code de secours restant')
    expect(tFr('backupCodesLeft', { count: 2 })).toBe('2 codes de secours restants')
  })
})
