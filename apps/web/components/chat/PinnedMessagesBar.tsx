'use client'

import { Pin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chatService } from '@/lib/api/chat'
import { toast } from 'sonner'

interface Props {
  pinnedMessages: string[]
  onUnpin: (messageId: string) => void
}

export function PinnedMessagesBar({ pinnedMessages, onUnpin }: Props) {
  if (pinnedMessages.length === 0) return null

  const handleUnpin = async (messageId: string) => {
    try {
      await chatService.unpinMessage(messageId)
      onUnpin(messageId)
    } catch {
      toast.error('Không thể bỏ ghim')
    }
  }

  return (
    <div className="border-b bg-muted/40 px-4 py-1.5 flex items-center gap-2 text-sm shrink-0">
      <Pin className="size-3.5 text-primary shrink-0" />
      <span className="text-muted-foreground flex-1 truncate">
        {pinnedMessages.length} tin nhắn đã ghim
      </span>
      {pinnedMessages.map((id) => (
        <Button
          key={id}
          variant="ghost"
          size="icon-xs"
          onClick={() => handleUnpin(id)}
          title="Bỏ ghim"
          className="size-5 shrink-0"
        >
          <X className="size-3" />
        </Button>
      ))}
    </div>
  )
}
