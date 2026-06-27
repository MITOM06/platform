'use client'

import { useState } from 'react'
import { Loader2, Send, Bot } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DialogA11yDescription } from '@/components/common/dialog-a11y-description'
import { chatService } from '@/lib/api/chat'
import { useConversations } from '@/lib/hooks/use-conversations'
import { useUser } from '@/lib/hooks/use-user'
import { useNickname } from '@/lib/nicknames'
import { useAuthStore } from '@/lib/store/auth.store'
import { absoluteMediaUrl } from '@/lib/media'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Conversation, Message } from '@/lib/api/types'

const AI_BOT_ID = 'ai-bot-000000000000000000000001'

interface Props {
  message: Message | null
  onClose: () => void
}

interface TargetProps {
  conv: Conversation
  disabled: boolean
  isForwarding: boolean
  onForward: (id: string) => void
}

// One row of the forward target list. Mirrors ConversationItem's name
// resolution so 1:1 / AI chats (whose `conv.name` is null) show the peer's
// nickname / displayName instead of the "Conversation" fallback.
function ForwardTarget({ conv, disabled, isForwarding, onForward }: TargetProps) {
  const t = useTranslations('chat')
  const currentUserId = useAuthStore((s) => s.user?.id)

  const isAI = conv.participants.includes(AI_BOT_ID)
  const otherUserId =
    !isAI && conv.type === 'direct'
      ? conv.participants.find((id) => id !== currentUserId)
      : undefined

  const { data: otherUser } = useUser(otherUserId)
  const otherNickname = useNickname(conv.id, otherUserId)

  const name =
    conv.name ??
    (isAI
      ? t('aiAssistant')
      : (otherNickname || otherUser?.displayName || t('conversationDefault')))
  const avatarUrl = conv.avatarUrl ?? otherUser?.avatarUrl
  const initial = name[0]?.toUpperCase() ?? '?'

  return (
    <button
      onClick={() => onForward(conv.id)}
      disabled={disabled}
      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-60 text-left"
    >
      <Avatar className="size-9 shrink-0">
        {isAI ? (
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="size-4" />
          </AvatarFallback>
        ) : (
          <>
            {avatarUrl && <AvatarImage src={absoluteMediaUrl(avatarUrl)} alt={name} />}
            <AvatarFallback className="text-xs font-medium">{initial}</AvatarFallback>
          </>
        )}
      </Avatar>
      <span className="flex-1 text-sm truncate">{name}</span>
      {isForwarding ? (
        <Loader2 className="size-4 animate-spin shrink-0 text-muted-foreground" />
      ) : (
        <Send className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
      )}
    </button>
  )
}

export function ForwardMessageModal({ message, onClose }: Props) {
  const queryClient = useQueryClient()
  const t = useTranslations('chat')
  const tCommon = useTranslations('common')
  const { data: conversations } = useConversations()
  const [forwardingTo, setForwardingTo] = useState<string | null>(null)

  const handleForward = async (targetId: string) => {
    if (!message || forwardingTo) return
    setForwardingTo(targetId)
    try {
      await chatService.forwardMessage(message.id, targetId)
      toast.success(t('forwardSuccess'))
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      onClose()
    } catch {
      toast.error(t('forwardError'))
    } finally {
      setForwardingTo(null)
    }
  }

  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('forwardTitle')}</DialogTitle>
        </DialogHeader>
          <DialogA11yDescription />

        <div className="mt-2 space-y-1 max-h-80 overflow-y-auto">
          {conversations?.map((conv) => {
            if (conv.id === message?.conversationId) return null
            return (
              <ForwardTarget
                key={conv.id}
                conv={conv}
                disabled={!!forwardingTo}
                isForwarding={forwardingTo === conv.id}
                onForward={handleForward}
              />
            )
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>{tCommon('cancel')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
