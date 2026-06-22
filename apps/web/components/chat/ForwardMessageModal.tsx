'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DialogA11yDescription } from '@/components/common/dialog-a11y-description'
import { chatService } from '@/lib/api/chat'
import { useConversations } from '@/lib/hooks/use-conversations'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import type { Message } from '@/lib/api/types'

interface Props {
  message: Message | null
  onClose: () => void
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
            const name = conv.name ?? t('forwardConversationFallback')
            const initial = name[0]?.toUpperCase() ?? '?'
            const isForwarding = forwardingTo === conv.id
            return (
              <button
                key={conv.id}
                onClick={() => handleForward(conv.id)}
                disabled={!!forwardingTo}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-60 text-left"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="text-xs font-medium">{initial}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm truncate">{name}</span>
                {isForwarding ? (
                  <Loader2 className="size-4 animate-spin shrink-0 text-muted-foreground" />
                ) : (
                  <Send className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </button>
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
