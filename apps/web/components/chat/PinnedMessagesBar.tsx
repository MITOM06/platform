'use client'

import { Pin, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { chatService } from '@/lib/api/chat'
import { toast } from 'sonner'

import type { PinnedMessage } from '@/lib/api/types'

interface Props {
  pinnedMessages: PinnedMessage[]
  onUnpin: (messageId: string) => void
}

export function PinnedMessagesBar({ pinnedMessages, onUnpin }: Props) {
  const t = useTranslations('chat')
  if (pinnedMessages.length === 0) return null

  const latest = pinnedMessages[0]!

  const handleUnpin = async (messageId: string) => {
    try {
      await chatService.unpinMessage(messageId)
      onUnpin(messageId)
    } catch {
      toast.error(t('pinError'))
    }
  }

  const handleJumpToLatest = () => {
    if (!latest) return
    const el = document.getElementById(`message-${latest.id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-primary/20', 'transition-all', 'duration-500', 'ring-2', 'ring-primary/40')
      setTimeout(() => {
        el.classList.remove('bg-primary/20', 'ring-2', 'ring-primary/40')
      }, 2000)
    } else {
      toast.info(t('pinnedScrollHint'))
    }
  }

  return (
    <div
      className="bg-pon-cyan/10 border-l-[3px] border-l-pon-cyan px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors hover:bg-pon-cyan/15 shrink-0"
      onClick={handleJumpToLatest}
    >
      <Pin className="size-3.5 text-pon-cyan shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-pon-cyan font-semibold uppercase tracking-wider mb-0.5">
          {t('pinnedMessages')}
        </p>
        <p className="text-xs text-foreground truncate">{latest.content}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={(e) => {
          e.stopPropagation()
          handleUnpin(latest.id)
        }}
        title={t('unpinMessage')}
        className="size-6 shrink-0 hover:bg-foreground/10 rounded-full"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
