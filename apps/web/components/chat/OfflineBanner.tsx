'use client'

import { useEffect, useRef, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { stompService } from '@/lib/stomp/client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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
    <div className="bg-red-500/10 border-b border-red-500/20 px-3 py-2 flex items-center">
      {/* Compact rail (< 200px): icon-only, hover → tooltip with the full label.
          The whole trigger is hidden at ≥ 200px via a container query on THIS
          wrapper (it lives inside the @container <aside>), so the tooltip can
          never open in the expanded state — no duplicate of the inline text.
          The container query is intentionally NOT on TooltipContent: that renders
          in a portal at <body>, outside the container, where it wouldn't resolve. */}
      <span className="@[200px]:hidden inline-flex">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default">
              <WifiOff className="size-4 text-red-500 shrink-0" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{t('offlineBanner')}</p>
          </TooltipContent>
        </Tooltip>
      </span>

      {/* Expanded rail (≥ 200px): icon + text, no tooltip needed. */}
      <span className="hidden @[200px]:flex items-center gap-2">
        <WifiOff className="size-4 text-red-500 shrink-0" />
        <span className="text-sm font-medium text-red-600 dark:text-red-400 truncate">
          {t('offlineBanner')}
        </span>
      </span>
    </div>
  )
}
