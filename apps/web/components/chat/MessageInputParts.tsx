'use client'

import {
  Send, X, Pencil, Paperclip, ImagePlus, FileText, Mic, Trash2, Reply, Plus,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Message } from '@/lib/api/types'

// Presentational sub-components extracted from MessageInput.tsx to keep the
// component under the 400-line limit. Behaviour + rendered output are identical
// to the inline versions.

const fmtSeconds = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

export function ReplyBanner({
  replyingTo,
  onCancelReply,
}: {
  replyingTo: Message
  onCancelReply?: () => void
}) {
  const t = useTranslations('chat')
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b text-sm">
      <Reply className="size-3.5 text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-primary">
          {t('replyTo', { name: replyingTo.senderName || '' })}
        </p>
        <p className="truncate text-xs text-muted-foreground">{replyingTo.content}</p>
      </div>
      <Button variant="ghost" size="icon-xs" onClick={onCancelReply}>
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

export function EditBanner({
  editingMessage,
  onCancelEdit,
}: {
  editingMessage: Message
  onCancelEdit?: () => void
}) {
  const t = useTranslations('chat')
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b text-sm">
      <Pencil className="size-3.5 text-primary shrink-0" />
      <span className="text-muted-foreground flex-1 truncate text-xs">
        {t('editing', { content: editingMessage.content })}
      </span>
      <Button variant="ghost" size="icon-xs" onClick={onCancelEdit}>
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

export function RecordingBar({
  recordSeconds,
  onCancel,
  onStopAndSend,
}: {
  recordSeconds: number
  onCancel: () => void
  onStopAndSend: () => void
}) {
  const t = useTranslations('chat')
  return (
    <div className="flex items-center gap-3 p-2 md:p-3">
      <Mic className="size-5 animate-pulse text-red-500" />
      <span className="flex-1 text-sm text-muted-foreground">
        {t('recording', { time: fmtSeconds(recordSeconds) })}
      </span>
      <Button variant="ghost" size="icon" onClick={onCancel} className="tap">
        <Trash2 className="size-4" />
      </Button>
      <Button size="icon" onClick={onStopAndSend} className="shrink-0 tap">
        <Send className="size-4" />
      </Button>
    </div>
  )
}

export function AttachMenu({
  disabled,
  onPickImage,
  onPickFile,
}: {
  disabled?: boolean
  onPickImage: () => void
  onPickFile: () => void
}) {
  const t = useTranslations('chat')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 tap" disabled={disabled}>
          <Paperclip className="size-5 text-pon-peach" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onClick={onPickImage}>
          <ImagePlus className="size-4" />
          {t('attachImageVideo')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPickFile}>
          <FileText className="size-4" />
          {t('attachFile')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SlashSuggestion({
  disabled,
  onSelect,
}: {
  disabled?: boolean
  onSelect: () => void
}) {
  const t = useTranslations('chat')
  return (
    <div className="absolute bottom-full left-0 mb-2 min-w-48 bg-popover border rounded-xl shadow-lg z-50 p-1">
      <button
        onClick={onSelect}
        disabled={disabled}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left rounded-lg hover:bg-muted transition-colors"
      >
        <Plus className="size-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">{t('aiNewSessionCommand')}</p>
          <p className="text-xs text-muted-foreground truncate">
            {t('aiNewSessionCommandDesc')}
          </p>
        </div>
      </button>
    </div>
  )
}

export function MentionPopover({
  candidates,
  activeIndex,
  onSelect,
  onHover,
}: {
  candidates: { id: string; name: string }[]
  activeIndex: number
  onSelect: (candidate: { id: string; name: string }) => void
  onHover: (idx: number) => void
}) {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-48 max-h-48 overflow-y-auto bg-popover border rounded-xl shadow-lg z-50">
      <div className="p-1 space-y-0.5">
        {candidates.map((candidate, idx) => (
          <button
            key={candidate.id}
            onClick={() => onSelect(candidate)}
            onMouseEnter={() => onHover(idx)}
            className={`w-full text-left px-3 py-2 text-sm rounded-lg truncate transition-colors ${
              idx === activeIndex ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'
            }`}
          >
            {candidate.name}
          </button>
        ))}
      </div>
    </div>
  )
}
