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

  const handleJumpToLatest = () => {
    const latestId = pinnedMessages[pinnedMessages.length - 1]
    if (!latestId) return
    const el = document.getElementById(`message-${latestId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-primary/20', 'transition-all', 'duration-500', 'ring-2', 'ring-primary/40')
      setTimeout(() => {
        el.classList.remove('bg-primary/20', 'ring-2', 'ring-primary/40')
      }, 2000)
    } else {
      toast.info('Tin nhắn ở vị trí cũ hơn, vui lòng cuộn lên để tìm')
    }
  }

  return (
    <div className="border-b bg-muted/40 px-4 py-1.5 flex items-center gap-2 text-sm shrink-0 select-none">
      <Pin className="size-3.5 text-primary shrink-0 animate-bounce" />
      <button
        onClick={handleJumpToLatest}
        className="text-muted-foreground flex-1 truncate text-left hover:text-foreground font-medium transition-colors cursor-pointer"
        title="Bấm để chuyển tới tin nhắn ghim mới nhất"
      >
        {pinnedMessages.length} tin nhắn đã ghim (Bấm để xem)
      </button>
      <div className="flex items-center gap-1">
        {pinnedMessages.map((id, index) => (
          <Button
            key={id}
            variant="ghost"
            size="icon-xs"
            onClick={() => handleUnpin(id)}
            title={`Bỏ ghim tin nhắn ${index + 1}`}
            className="size-5 shrink-0 hover:bg-destructive/10 hover:text-destructive rounded-full"
          >
            <X className="size-3" />
          </Button>
        ))}
      </div>
    </div>
  )
}
