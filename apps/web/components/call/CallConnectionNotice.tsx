'use client'

import { useTranslations } from 'next-intl'
import { useCallStore } from '@/lib/store/call.store'
import { cn } from '@/lib/utils'

/** "Reconnecting…" / "Poor connection" under the call status (LiveKit calls). */
export function CallConnectionNotice({ className }: { className?: string }) {
  const t = useTranslations('call')
  const reconnecting = useCallStore((s) => s.reconnecting)
  const poor = useCallStore((s) => s.poorConnection)
  if (!reconnecting && !poor) return null
  return (
    <p role="status" className={cn('text-xs font-medium text-white/80', className)}>
      {reconnecting ? t('reconnecting') : t('poorConnection')}
    </p>
  )
}
