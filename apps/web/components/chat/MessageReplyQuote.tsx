'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { humanizeMessagePreview } from '@/lib/system-messages'
import { useNickname } from '@/lib/nicknames'
import { useUser } from '@/lib/hooks/use-user'
import type { Message } from '@/lib/api/types'

interface Props {
  replyPreview: NonNullable<Message['replyPreview']>
  isOwn: boolean
  currentUserId?: string
  conversationId?: string
  resolveName: (actorId: string) => string | undefined
}

/**
 * Quote of the replied-to message at the top of a bubble. Clicking it scrolls to and briefly
 * highlights the original.
 */
export function MessageReplyQuote({
  replyPreview,
  isOwn,
  currentUserId,
  conversationId,
  resolveName,
}: Props) {
  const t = useTranslations('chat')
  const replyNickname = useNickname(conversationId ?? '', replyPreview.senderId)
  // Resolve the replied-to message's author (not the current message's sender).
  const { data: repliedSender } = useUser(replyPreview.senderId)

  return (
    <button
      type="button"
      className={cn(
        'mb-2 w-full pl-2 border-l-2 text-left text-xs opacity-80 cursor-pointer select-none transition-colors hover:opacity-100 rounded-xs py-0.5',
        isOwn
          ? 'border-primary-foreground/40 bg-primary-foreground/10 hover:bg-primary-foreground/15'
          : 'border-primary/50 bg-primary/5 hover:bg-primary/10',
      )}
      onClick={() => {
        const el = document.getElementById(`message-${replyPreview.messageId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('bg-primary/20', 'transition-all', 'duration-500', 'ring-2', 'ring-primary/40')
          setTimeout(() => {
            el.classList.remove('bg-primary/20', 'ring-2', 'ring-primary/40')
          }, 2000)
        }
      }}
    >
      <p className="font-semibold mb-0.5">
        {replyPreview.senderId === currentUserId
          ? t('you')
          : (replyNickname || repliedSender?.displayName || '')}
      </p>
      {/* Never render replied-to content raw (system code / upload URL / JSON
          payload — rule: no-raw-system-data-in-ui); humanize by sniffing it. */}
      <p className="truncate italic">
        {humanizeMessagePreview(replyPreview.content, undefined, t, {
          short: true,
          resolveName,
        })}
      </p>
    </button>
  )
}
