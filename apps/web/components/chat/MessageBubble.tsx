import { cn } from '@/lib/utils'
import type { Message } from '@/lib/api/types'

interface Props {
  message: Message
  isOwn: boolean
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessageBubble({ message, isOwn }: Props) {
  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-3 py-2 text-sm break-words',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        {!isOwn && message.senderName && (
          <p className="text-xs font-medium mb-1 opacity-70">{message.senderName}</p>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            'text-xs mt-1 text-right',
            isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground',
          )}
        >
          {formatTime(message.createdAt)}
          {message.editedAt && <span className="ml-1 italic">đã sửa</span>}
        </p>
      </div>
    </div>
  )
}
