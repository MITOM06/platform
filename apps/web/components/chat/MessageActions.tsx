'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  MoreHorizontal, Pencil, Trash2, Trash, Share2, Pin, PinOff, Smile, Brain, Reply, CheckCheck, Copy, CheckSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { chatService } from '@/lib/api/chat'
import type { Message } from '@/lib/api/types'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

interface Props {
  message: Message
  isOwn: boolean
  currentUserId?: string
  isPinned: boolean
  pinnedCount?: number
  onEdit?: () => void
  onForward?: () => void
  onReply?: () => void
  onAiTrace?: () => void
  onGroupReadDetails?: () => void
  onReactionsDetail?: () => void
  onEnterMultiSelect?: () => void
  onOptimisticUpdate: (updated: Partial<Message> & { id: string }) => void
  /** Notifies the parent when the actions menu opens/closes, so the exact
   *  timestamp can be surfaced as a sticky chip at the top of the viewport. */
  onMenuOpen?: () => void
  onMenuClose?: () => void
}

export function MessageActions({
  message,
  isOwn,
  currentUserId,
  isPinned,
  pinnedCount = 0,
  onEdit,
  onForward,
  onReply,
  onAiTrace,
  onGroupReadDetails,
  onReactionsDetail,
  onEnterMultiSelect,
  onOptimisticUpdate,
  onMenuOpen,
  onMenuClose,
}: Props) {
  const [emojiOpen, setEmojiOpen] = useState(false)
  const t = useTranslations('chat')

  const isCallLog = message.type === 'call_log'

  const handleReact = async (emoji: string) => {
    setEmojiOpen(false)
    try {
      const existing = message.reactions?.find(
        (r) => r.emoji === emoji && r.userId === currentUserId,
      )
      if (existing) {
        await chatService.removeReaction(message.id)
      } else {
        await chatService.addReaction(message.id, emoji)
      }
    } catch {
      toast.error(t('reactError'))
    }
  }

  const handleRecall = async () => {
    try {
      await chatService.recallMessage(message.id)
    } catch {
      toast.error(t('recallError'))
    }
  }

  const handleDeleteForMe = async () => {
    try {
      await chatService.deleteForMe(message.id)
      onOptimisticUpdate({ id: message.id, deletedFor: ['__me__'] })
    } catch {
      toast.error(t('deleteError'))
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      toast.success(t('copySuccess'))
    } catch {
      toast.error(t('copyError'))
    }
  }

  const canCopy = message.type === 'text' || message.type === 'ai'

  const handlePin = async () => {
    if (!isPinned && pinnedCount >= 2) {
      toast.warning(t('pinLimitReached'))
      return
    }
    try {
      if (isPinned) {
        await chatService.unpinMessage(message.id)
      } else {
        await chatService.pinMessage(message.id)
      }
    } catch {
      toast.error(t('pinError'))
    }
  }

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Quick emoji reactions */}
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="size-6 rounded-full">
            <Smile className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top" align="center">
          <div className="flex gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="text-lg hover:scale-125 transition-transform leading-none p-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* More actions menu */}
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) onMenuOpen?.()
          else onMenuClose?.()
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="size-6 rounded-full">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="min-w-44">
          {onEnterMultiSelect && (
            <>
              <DropdownMenuItem onClick={onEnterMultiSelect}>
                <CheckSquare className="size-4" />
                {t('selectMessages')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={onReply}>
            <Reply className="size-4" />
            {t('replyAction')}
          </DropdownMenuItem>
          {canCopy && !message.recalled && (
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="size-4" />
              {t('copyAction')}
            </DropdownMenuItem>
          )}
          {isOwn && !message.recalled && message.type === 'text' && (
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" />
              {t('editAction')}
            </DropdownMenuItem>
          )}
          {!isCallLog && (
            <DropdownMenuItem onClick={handlePin}>
              {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              {isPinned ? t('unpinMessage') : t('pinMessage')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onForward}>
            <Share2 className="size-4" />
            {t('forwardAction')}
          </DropdownMenuItem>
          {message.type === 'ai' && (
            <DropdownMenuItem onClick={onAiTrace}>
              <Brain className="size-4" />
              {t('viewAiTrace')}
            </DropdownMenuItem>
          )}
          {onGroupReadDetails && (
            <DropdownMenuItem onClick={onGroupReadDetails}>
              <CheckCheck className="size-4 text-pon-cyan" />
              <span className="text-pon-cyan">{t('readByDetails')}</span>
            </DropdownMenuItem>
          )}
          {onReactionsDetail && message.reactions && message.reactions.length > 0 && (
            <DropdownMenuItem onClick={onReactionsDetail}>
              <Smile className="size-4" />
              {t('reactionsDetailAction')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isOwn && !message.recalled && (
            <DropdownMenuItem variant="destructive" onClick={handleRecall}>
              <Trash2 className="size-4" />
              {t('recallAction')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={handleDeleteForMe}>
            <Trash className="size-4" />
            {t('deleteForMeAction')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
