'use client'

import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUser } from '@/lib/hooks/use-user'
import { chatService } from '@/lib/api/chat'
import { getNickname } from '@/lib/nicknames'
import { PinnedMessageRow } from './PinnedMessageRow'
import type { PinnedMessage } from '@/lib/api/types'

interface Props {
  conversationId: string
  pinnedMessages: PinnedMessage[]
  /** Close the drawer before jumping to the message in the thread. */
  onJump?: () => void
}

/** Resolves a sender's display name (nickname overrides backend name). */
function useSenderName(conversationId: string, senderId: string): string {
  const { data: user } = useUser(senderId)
  return getNickname(conversationId, senderId) ?? user?.displayName ?? '…'
}

const MEDIA_TYPES = new Set(['voice', 'image', 'video', 'file', 'sticker'])

function PinnedRow({
  conversationId,
  pinned,
  unpinLabel,
  attachmentLabel,
  onJump,
  onUnpin,
}: {
  conversationId: string
  pinned: PinnedMessage
  unpinLabel: string
  attachmentLabel: string
  onJump?: () => void
  onUnpin: (id: string) => void
}) {
  const senderName = useSenderName(conversationId, pinned.senderId)
  const displayContent =
    pinned.type && MEDIA_TYPES.has(pinned.type) ? attachmentLabel : pinned.content

  const handleJump = () => {
    onJump?.()
    // Allow drawer close animation, then scroll to the message.
    setTimeout(() => {
      const el = document.getElementById(`message-${pinned.id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }

  return (
    <PinnedMessageRow
      content={displayContent}
      senderLabel={senderName}
      unpinLabel={unpinLabel}
      onJump={handleJump}
      onUnpin={() => onUnpin(pinned.id)}
    />
  )
}

/**
 * Pinned Messages section for the conversation info / settings drawer.
 * Shows up to 2 pinned messages with sender + truncated content and an unpin (X) action.
 * Mobile mirror: pinned_messages_section.dart.
 */
export function PinnedMessagesSection({ conversationId, pinnedMessages, onJump }: Props) {
  const t = useTranslations('chat')
  const queryClient = useQueryClient()

  if (pinnedMessages.length === 0) return null

  const visible = pinnedMessages.slice(0, 2)

  const handleUnpin = async (messageId: string) => {
    try {
      await chatService.unpinMessage(messageId)
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
    } catch {
      toast.error(t('pinError'))
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        {t('pinnedMessages')}
      </p>
      <div className="space-y-1.5">
        {visible.map((pinned) => (
          <PinnedRow
            key={pinned.id}
            conversationId={conversationId}
            pinned={pinned}
            unpinLabel={t('unpinMessage')}
            attachmentLabel={t('attachmentLabel')}
            onJump={onJump}
            onUnpin={handleUnpin}
          />
        ))}
      </div>
    </div>
  )
}
