'use client'

import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUser } from '@/lib/hooks/use-user'
import { chatService } from '@/lib/api/chat'
import { getNickname } from '@/lib/nicknames'
import { humanizeMessagePreview } from '@/lib/system-messages'
import { useAuthStore } from '@/lib/store/auth.store'
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

type Translate = (key: string, values?: Record<string, string | number>) => string

function PinnedRow({
  conversationId,
  currentUserId,
  pinned,
  unpinLabel,
  t,
  onJump,
  onUnpin,
}: {
  conversationId: string
  currentUserId?: string
  pinned: PinnedMessage
  unpinLabel: string
  t: Translate
  onJump?: () => void
  onUnpin: (id: string) => void
}) {
  const senderName = useSenderName(conversationId, pinned.senderId)
  const queryClient = useQueryClient()

  // Resolve an actor id → display name for system codes that carry one
  // (mirror MessageBubble.tsx). Never leak raw ids — see
  // .claude/rules/no-raw-system-data-in-ui.md.
  const resolveName = (actorId: string): string | undefined => {
    if (actorId === currentUserId) return t('you')
    const nick = getNickname(conversationId, actorId)
    if (nick) return nick
    const cached = queryClient.getQueryData<{ displayName?: string }>(['user', actorId])
    return cached?.displayName
  }

  // Never leak raw JSON/markdown/system codes — see
  // .claude/rules/no-raw-system-data-in-ui.md. The shared preview humanizer maps
  // media/file → attachment label, meeting_summary → its label, ai → flattened
  // text, and system codes → humanized sentence.
  const displayContent = humanizeMessagePreview(pinned.content, pinned.type, t, { resolveName })

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
  const currentUserId = useAuthStore((s) => s.user?.id)

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
            currentUserId={currentUserId}
            pinned={pinned}
            unpinLabel={t('unpinMessage')}
            t={t}
            onJump={onJump}
            onUnpin={handleUnpin}
          />
        ))}
      </div>
    </div>
  )
}
