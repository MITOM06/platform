import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { stompService } from '@/lib/stomp/client'

export function OfflineBanner() {
  const t = useTranslations('chat')
  const [isOffline, setIsOffline] = useState(!stompService.isConnected())

  useEffect(() => {
    const unsubscribe = stompService.onStateChange((connected) => {
      setIsOffline(!connected)
    })
    return () => unsubscribe()
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
