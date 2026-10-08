'use client'

import { useTranslations } from 'next-intl'
import { useCallStore } from '@/lib/store/call.store'
import { networkNotice } from '@/lib/webrtc/call-network'
import { cn } from '@/lib/utils'

/** Whose network is weak, under the call status (both media paths). */
export function CallConnectionNotice({ className }: { className?: string }) {
  const t = useTranslations('call')
  const selfPoor = useCallStore((s) => s.poorConnection)
  const peerPoor = useCallStore((s) => s.peerPoor)
  const peerName = useCallStore((s) => s.peerName)
  const notice = networkNotice(selfPoor, peerPoor)
  if (!notice) return null
  const text =
    notice === 'self'
      ? t('selfWeakNetwork')
      : notice === 'peer'
        ? t('peerWeakNetwork', { name: peerName || t('peerFallback') })
        : t('unstableNetwork')
  return (
    <p role="status" className={cn('text-xs font-medium text-white/80', className)}>
      {text}
    </p>
  )
}
