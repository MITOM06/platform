'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { authService } from '@/lib/api/auth'

interface Props {
  otherUserId: string
  otherUserName: string
  iBlocked: boolean
  blockedMe: boolean
  onUnblocked?: () => void
}

export function BlockedComposerNotice({
  otherUserId,
  otherUserName,
  iBlocked,
  onUnblocked,
}: Props) {
  const queryClient = useQueryClient()
  const [unblocking, setUnblocking] = useState(false)

  const handleUnblock = async () => {
    setUnblocking(true)
    try {
      await authService.unblockUser(otherUserId)
      queryClient.invalidateQueries({ queryKey: ['relationship', otherUserId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversation'] })
      onUnblocked?.()
      toast.success(`Đã bỏ chặn ${otherUserName}`)
    } catch {
      toast.error('Không thể bỏ chặn người dùng')
    } finally {
      setUnblocking(false)
    }
  }

  return (
    <div className="h-16 border-t px-4 flex items-center justify-between gap-4 bg-muted/40 select-none animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2.5">
        <div className="size-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
          <Ban className="size-4 text-destructive" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">
          {iBlocked
            ? `Bạn đã chặn ${otherUserName}. Hãy bỏ chặn để nhắn tin.`
            : `Không thể gửi tin nhắn do giới hạn kết nối.`}
        </p>
      </div>

      {iBlocked && (
        <Button
          size="sm"
          onClick={handleUnblock}
          disabled={unblocking}
          className="rounded-full text-xs font-semibold px-4 bg-primary text-primary-foreground hover:opacity-90 shadow-sm shrink-0"
        >
          {unblocking ? (
            <Loader2 className="size-3 animate-spin mr-1.5" />
          ) : (
            <ShieldCheck className="size-3.5 mr-1.5" />
          )}
          Bỏ chặn
        </Button>
      )}
    </div>
  )
}
