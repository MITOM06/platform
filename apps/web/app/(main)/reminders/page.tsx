'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  AlarmClock,
  Loader2,
  Trash2,
  CheckCircle,
  AlertCircle,
  AlarmClockOff,
} from 'lucide-react'
import { reminderService, type Reminder } from '@/lib/api/reminders'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// ── Reminder Tile ────────────────────────────────────────────────────────────

function ReminderTile({
  reminder,
  onDone,
  onDelete,
}: {
  reminder: Reminder
  onDone: () => void
  onDelete: () => void
}) {
  const dateStr = new Date(reminder.remindAt).toLocaleString('vi-VN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="group rounded-xl border bg-card p-4 transition-all hover:shadow-lg hover:border-pon-cyan/30 relative flex items-center gap-4 overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl bg-gradient-to-r from-pon-cyan/[0.03] to-transparent" />

      {/* Icon */}
      <div className="size-10 rounded-lg bg-pon-cyan/10 flex items-center justify-center shrink-0">
        <AlarmClock className="size-5 text-pon-cyan" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate mb-0.5">
          {reminder.text}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {dateStr}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onDone}
          className="size-8 rounded-lg flex items-center justify-center text-pon-cyan/70 hover:text-pon-cyan hover:bg-pon-cyan/10 transition-colors"
          title="Đánh dấu hoàn thành"
        >
          <CheckCircle className="size-4" />
        </button>
        <button
          onClick={onDelete}
          className="size-8 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Xóa nhắc nhở"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <AlarmClockOff className="size-20 text-muted-foreground/15" />
      <div className="text-center space-y-1.5">
        <p className="text-sm text-muted-foreground/50">
          Không có nhắc nhở nào
        </p>
        <p className="text-xs text-muted-foreground/30 max-w-[280px]">
          Bạn có thể tạo nhắc nhở bằng cách yêu cầu AI hoặc nhắn &quot;Nhắc tôi...&quot;.
        </p>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const queryClient = useQueryClient()
  
  const [confirmDoneTarget, setConfirmDoneTarget] = useState<Reminder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null)

  const { data: reminders, isLoading, error } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => reminderService.getReminders(),
  })

  const doneMutation = useMutation({
    mutationFn: (id: string) => reminderService.markDone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Đã hoàn thành nhắc nhở')
      setConfirmDoneTarget(null)
    },
    onError: () => toast.error('Lỗi khi cập nhật nhắc nhở'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reminderService.deleteReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      toast.success('Đã xóa nhắc nhở')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Không thể xóa nhắc nhở'),
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center gap-3 shrink-0 bg-background/95 backdrop-blur-md">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">Nhắc nhở</span>
      </header>

      <div className="flex-1 overflow-y-auto relative">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-pon-cyan/5 blur-3xl" />
        </div>

        <div className="relative max-w-lg mx-auto px-6 py-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="size-8 animate-spin text-pon-cyan" />
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertCircle className="size-10 text-destructive/50" />
              <p className="text-sm text-destructive">Không thể tải danh sách nhắc nhở</p>
            </div>
          )}

          {reminders && reminders.length === 0 && <EmptyState />}

          {reminders && reminders.length > 0 && (
            <div className="space-y-2">
              {reminders.map((r) => (
                <ReminderTile
                  key={r.id}
                  reminder={r}
                  onDone={() => setConfirmDoneTarget(r)}
                  onDelete={() => setDeleteTarget(r)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Done confirmation dialog */}
      <Dialog open={!!confirmDoneTarget} onOpenChange={(open) => !open && setConfirmDoneTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hoàn thành nhắc nhở</DialogTitle>
            <DialogDescription>
              Đánh dấu &quot;{confirmDoneTarget?.text}&quot; là đã hoàn thành?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDoneTarget(null)}
              disabled={doneMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              className="bg-pon-cyan text-black hover:bg-pon-cyan/90"
              onClick={() => confirmDoneTarget && doneMutation.mutate(confirmDoneTarget.id)}
              disabled={doneMutation.isPending}
            >
              {doneMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa nhắc nhở</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa nhắc nhở &quot;{deleteTarget?.text}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
