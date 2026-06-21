'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common')
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">{t('somethingWrong')}</h2>
      <p className="text-sm text-muted-foreground">{error.message || t('unknownError')}</p>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  )
}
