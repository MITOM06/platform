'use client'

import { useEffect, useRef, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { stompService } from '@/lib/stomp/client'

// Debounce: only show "offline" banner after this many ms of disconnection.
// Prevents false positives during token-refresh reconnect cycles (~1-2s).
const OFFLINE_DEBOUNCE_MS = 3_000

export function OfflineBanner() {
  const t = useTranslations('chat')
  const [isOffline, setIsOffline] = useState(false) // start hidden — don't flash on mount
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = stompService.onStateChange((connected) => {
      if (connected) {
        // Reconnected → clear pending debounce and immediately hide banner
        clearTimeout(timerRef.current)
        setIsOffline(false)
      } else {
        // Disconnected → wait before showing banner (avoid reconnect flicker)
        timerRef.current = setTimeout(() => {
          setIsOffline(true)
        }, OFFLINE_DEBOUNCE_MS)
      }
    })
    return () => {
      unsubscribe()
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center gap-2">
      <WifiOff className="size-4 text-red-500 shrink-0" />
      <span className="text-sm font-medium text-red-600 dark:text-red-400">
        {t('offlineBanner')}
      </span>
    </div>
  )
}
