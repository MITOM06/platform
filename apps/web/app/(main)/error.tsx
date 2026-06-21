'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export default function MainError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common')
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold">{t('somethingWrong')}</h2>
      <p className="text-sm text-muted-foreground">{error.message || t('unknownError')}</p>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  )
}
