'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function OfflineBanner() {
  const t = useTranslations('chat')
  const [isOffline, setIsOffline] = useState(false) // start hidden — don't flash on mount

  // Key the banner off the browser's REAL network state, never off the STOMP
  // socket. Cloud Run severs the WebSocket on its request-timeout every N
  // minutes; STOMP then reconnects (reconnectDelay), and keying "No internet"
  // off those healthy reconnect cycles made the banner flash constantly even
  // with a perfect connection. navigator.onLine mirrors what the Flutter client
  // does with connectivity_plus — both platforms now show this banner only when
  // the device is genuinely offline.
  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine)
    update() // sync to the current network state on mount
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
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
