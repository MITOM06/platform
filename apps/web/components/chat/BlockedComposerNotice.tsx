'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authService } from '@/lib/api/auth'

interface Props {
  otherUserId: string
  otherUserName: string
  /** True when the current user has blocked the other user. */
  iBlocked: boolean
  /** True when the other user has blocked the current user. */
  blockedMe: boolean
  onUnblocked?: () => void
}

export function BlockedComposerNotice({
  otherUserId,
  otherUserName,
  iBlocked,
  blockedMe,
  onUnblocked,
}: Props) {
  const t = useTranslations('chat')
  const queryClient = useQueryClient()
  const [unblocking, setUnblocking] = useState(false)

  const handleUnblock = async () => {
    setUnblocking(true)
    try {
      await authService.unblockUser(otherUserId)
      queryClient.invalidateQueries({ queryKey: ['relationship', otherUserId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      onUnblocked?.()
      toast.success(t('userUnblockedName', { name: otherUserName }))
    } catch {
      toast.error(t('unblockError'))
    } finally {
      setUnblocking(false)
    }
  }

  // Distinguish "I blocked them" (actionable — offer Unblock) from "they blocked
  // me" (not actionable — only an explanatory notice).
  const message = iBlocked
    ? t('youBlockedNotice', { name: otherUserName })
    : blockedMe
      ? t('blockedByOtherNotice')
      : t('connectionLimitedNotice')

  return (
    <div className="h-16 border-t px-4 flex items-center justify-between gap-4 bg-muted/40 select-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2.5">
        <div className="size-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
          <Ban className="size-4 text-destructive" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">
          {message}
        </p>
      </div>

      {iBlocked && (
        <Button
          size="sm"
          onClick={handleUnblock}
          disabled={unblocking}
          className="rounded-full text-xs font-semibold px-4 bg-primary text-primary-foreground hover:opacity-90 shadow-sm shrink-0"
        >
          {unblocking ? (
            <Loader2 className="size-3 animate-spin mr-1.5" />
          ) : (
            <ShieldCheck className="size-3.5 mr-1.5" />
          )}
          {t('unblockAction')}
        </Button>
      )}
    </div>
  )
}
