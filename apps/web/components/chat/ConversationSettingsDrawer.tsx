'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  BellOff, Bell, Archive, ArchiveX, Trash2, Eraser, Timer,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { chatService } from '@/lib/api/chat'
import type { Conversation } from '@/lib/api/types'

interface Props {
  conversation: Conversation
  currentUserId: string
  open: boolean
  onClose: () => void
}

const AUTO_DELETE_OPTIONS = [
  { label: 'Tắt', value: 0 },
  { label: '1 giờ', value: 3600 },
  { label: '1 ngày', value: 86400 },
  { label: '1 tuần', value: 604800 },
  { label: '1 tháng', value: 2592000 },
]

export function ConversationSettingsDrawer({
  conversation,
  currentUserId,
  open,
  onClose,
}: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const isMuted = conversation.mutedUsers.includes(currentUserId)
  const isArchived = conversation.archivedBy.includes(currentUserId)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] })
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    setSaving(true)
    try {
      await action()
      toast.success(success)
      invalidate()
    } catch {
      toast.error('Thao tác thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleMuteToggle = () =>
    run(
      () => isMuted
        ? chatService.unmuteConversation(conversation.id)
        : chatService.muteConversation(conversation.id),
      isMuted ? 'Đã bật thông báo' : 'Đã tắt thông báo',
    )

  const handleArchiveToggle = () =>
    run(
      () => isArchived
        ? chatService.unarchiveConversation(conversation.id)
        : chatService.archiveConversation(conversation.id),
      isArchived ? 'Đã bỏ lưu trữ' : 'Đã lưu trữ',
    )

  const handleClearHistory = async () => {
    if (!confirm('Xóa toàn bộ lịch sử? Hành động không thể hoàn tác.')) return
    await run(() => chatService.clearHistory(conversation.id), 'Đã xóa lịch sử')
    queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] })
  }

  const handleDelete = async () => {
    if (!confirm('Xóa cuộc trò chuyện? Hành động không thể hoàn tác.')) return
    await run(async () => {
      await chatService.deleteConversation(conversation.id)
      invalidate()
      onClose()
      router.push('/conversations')
    }, 'Đã xóa')
  }

  const handleAutoDelete = async (idx: number) => {
    const seconds = AUTO_DELETE_OPTIONS[idx]?.value ?? 0
    await run(
      () => chatService.updateSettings(conversation.id, seconds > 0 ? seconds : null),
      'Đã cập nhật tự động xóa',
    )
  }

  const currentAutoDeleteIdx = AUTO_DELETE_OPTIONS.findIndex(
    (o) => o.value === (conversation.autoDeleteSeconds ?? 0),
  )
  const sliderValue = currentAutoDeleteIdx >= 0 ? currentAutoDeleteIdx : 0

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-80 sm:w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cài đặt cuộc trò chuyện</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-6 pb-6">
          <Separator />

          {/* Mute / unmute */}
          <button
            onClick={handleMuteToggle}
            disabled={saving}
            className="flex items-center gap-3 text-sm hover:bg-muted/50 rounded-lg px-2 py-2.5 transition-colors"
          >
            {isMuted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            {isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
          </button>

          {/* Archive */}
          <button
            onClick={handleArchiveToggle}
            disabled={saving}
            className="flex items-center gap-3 text-sm hover:bg-muted/50 rounded-lg px-2 py-2.5 transition-colors"
          >
            {isArchived ? <ArchiveX className="size-4" /> : <Archive className="size-4" />}
            {isArchived ? 'Bỏ lưu trữ' : 'Lưu trữ'}
          </button>

          <Separator />

          {/* Auto-delete timer */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Timer className="size-4" />
              Tự động xóa tin nhắn
            </div>
            <Slider
              min={0}
              max={AUTO_DELETE_OPTIONS.length - 1}
              step={1}
              value={[sliderValue]}
              onValueChange={([v]) => handleAutoDelete(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              {AUTO_DELETE_OPTIONS.map((o, i) => (
                <span key={i} className={i === sliderValue ? 'text-primary font-medium' : ''}>
                  {o.label}
                </span>
              ))}
            </div>
          </div>

          <Separator />

          {/* Clear history */}
          <button
            onClick={handleClearHistory}
            disabled={saving}
            className="flex items-center gap-3 text-sm text-destructive hover:bg-destructive/10 rounded-lg px-2 py-2.5 transition-colors"
          >
            <Eraser className="size-4" />
            Xóa lịch sử trò chuyện
          </button>

          {/* Delete conversation */}
          <button
            onClick={handleDelete}
            disabled={saving}
            className="flex items-center gap-3 text-sm text-destructive hover:bg-destructive/10 rounded-lg px-2 py-2.5 transition-colors"
          >
            <Trash2 className="size-4" />
            Xóa cuộc trò chuyện
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
