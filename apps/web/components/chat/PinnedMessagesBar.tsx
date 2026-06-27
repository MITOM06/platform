'use client'

import { useState } from 'react'
import { Pin, X, ChevronUp, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { chatService } from '@/lib/api/chat'
import { toast } from 'sonner'

import type { PinnedMessage } from '@/lib/api/types'

interface Props {
  pinnedMessages: PinnedMessage[]
  onUnpin: (messageId: string) => void
}

const MEDIA_TYPES = new Set(['voice', 'image', 'video', 'file', 'sticker'])

function getDisplayContent(content: string, type: string | undefined, attachmentLabel: string): string {
  return type && MEDIA_TYPES.has(type) ? attachmentLabel : content
}

export function PinnedMessagesBar({ pinnedMessages, onUnpin }: Props) {
  const t = useTranslations('chat')
  const [expanded, setExpanded] = useState(false)

  if (pinnedMessages.length === 0) return null

  const latest = pinnedMessages[0]!
  const extraCount = pinnedMessages.length - 1
  const hasMore = extraCount > 0
  const attachmentLabel = t('attachmentLabel')
  const latestContent = getDisplayContent(latest.content, latest.type, attachmentLabel)

  const handleUnpin = async (messageId: string) => {
    try {
      await chatService.unpinMessage(messageId)
      onUnpin(messageId)
      if (pinnedMessages.length <= 1) setExpanded(false)
    } catch {
      toast.error(t('pinError'))
    }
  }

  const handleJump = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`)
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

  if (expanded) {
    return (
      <div className="bg-pon-cyan/10 border-l-[3px] border-l-pon-cyan shrink-0">
        {/* Expanded header — click to collapse */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-pon-cyan/15 transition-colors"
          onClick={() => setExpanded(false)}
        >
          <Pin className="size-3.5 text-pon-cyan shrink-0" />
          <p className="text-[10px] text-pon-cyan font-semibold uppercase tracking-wider flex-1">
            {t('pinnedMessages')} ({pinnedMessages.length})
          </p>
          <ChevronUp className="size-3.5 text-pon-cyan shrink-0" />
        </div>
        {/* Each pinned message as its own row */}
        {pinnedMessages.map((pin) => (
          <div
            key={pin.id}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-pon-cyan/15 cursor-pointer transition-colors border-t border-pon-cyan/10"
            onClick={() => { setExpanded(false); setTimeout(() => handleJump(pin.id), 150) }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">
                {getDisplayContent(pin.content, pin.type, attachmentLabel)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => { e.stopPropagation(); handleUnpin(pin.id) }}
              title={t('unpinMessage')}
              className="size-6 shrink-0 hover:bg-foreground/10 rounded-full"
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    )
  }

  // Collapsed view — single row showing latest pin
  return (
    <div
      className="bg-pon-cyan/10 border-l-[3px] border-l-pon-cyan px-3 py-1.5 flex items-center gap-2 cursor-pointer transition-colors hover:bg-pon-cyan/15 shrink-0"
      onClick={() => (hasMore ? setExpanded(true) : handleJump(latest.id))}
    >
      <Pin className="size-3.5 text-pon-cyan shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-pon-cyan font-semibold uppercase tracking-wider mb-0.5">
          {t('pinnedMessages')}
        </p>
        <p className="text-xs text-foreground truncate">{latestContent}</p>
      </div>
      {hasMore && (
        <span className="text-[10px] font-semibold text-pon-cyan bg-pon-cyan/20 px-1.5 py-0.5 rounded-full shrink-0">
          +{extraCount}
        </span>
      )}
      {hasMore ? (
        <ChevronDown className="size-3.5 text-pon-cyan shrink-0" />
      ) : (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={(e) => { e.stopPropagation(); handleUnpin(latest.id) }}
          title={t('unpinMessage')}
          className="size-6 shrink-0 hover:bg-foreground/10 rounded-full"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  )
}
