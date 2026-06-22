'use client'

import { useTranslations } from 'next-intl'
import { DialogDescription } from '@/components/ui/dialog'

/**
 * Screen-reader-only `DialogDescription` for dialogs whose purpose is already
 * conveyed visually by their title/body. Satisfies Radix's a11y requirement
 * (every Dialog should have a description or explicit aria-describedby) without
 * adding visible chrome. Text is i18n'd via the shared `common` namespace.
 */
export function DialogA11yDescription() {
  const t = useTranslations('common')
  return <DialogDescription className="sr-only">{t('dialogDescription')}</DialogDescription>
}
