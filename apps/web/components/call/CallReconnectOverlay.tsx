'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { useCallStore } from '@/lib/store/call.store'
import { RECONNECT_GRACE_MS } from '@/lib/webrtc/call-config'

/**
 * Someone dropped: the call waits up to a minute for them (or for us) before
 * ending. Covers the call screen with whose connection it waits for and a
 * countdown; the call goes on underneath when the connection comes back.
 */
export function CallReconnectOverlay() {
  const t = useTranslations('call')
  const who = useCallStore((s) => s.reconnectWait)
  const deadline = useCallStore((s) => s.reconnectDeadline)
  const peerName = useCallStore((s) => s.peerName)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!who) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0) // `now` may date from before the drop
    const id = setInterval(tick, 1_000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [who])

  if (!who || !deadline) return null
  const seconds = Math.min(RECONNECT_GRACE_MS / 1_000, Math.max(0, Math.ceil((deadline - now) / 1_000)))
  return (
    <div
      role="alert"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 text-center text-white"
    >
      <Loader2 className="size-8 animate-spin" aria-hidden />
      <p className="text-lg font-medium">
        {who === 'self' ? t('reconnectingSelf') : t('waitingForPeer', { name: peerName || t('peerFallback') })}
      </p>
      <p className="text-sm text-white/70">{t('reconnectCountdown', { seconds })}</p>
    </div>
  )
}
