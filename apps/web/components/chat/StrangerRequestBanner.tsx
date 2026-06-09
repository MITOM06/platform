'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageCircle, ShieldAlert, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { chatService } from '@/lib/api/chat'
import { authService } from '@/lib/api/auth'

interface Props {
  conversationId: string
  otherUserId: string
  otherUserName: string
  onAccepted: () => void
}

export function StrangerRequestBanner({
  conversationId,
  otherUserId,
  otherUserName,
  onAccepted,
}: Props) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState<'accept' | 'block' | null>(null)

  const handleAccept = async () => {
    setLoading('accept')
    try {
      await chatService.acceptConversation(conversationId)
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      onAccepted()
      toast.success(`Đã chấp nhận cuộc trò chuyện với ${otherUserName}`)
    } catch {
      toast.error('Không thể chấp nhận cuộc trò chuyện')
    } finally {
      setLoading(null)
    }
  }

  const handleBlock = async () => {
    setLoading('block')
    try {
      await authService.blockUser(otherUserId)
      queryClient.invalidateQueries({ queryKey: ['relationship', otherUserId] })
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success(`Đã chặn ${otherUserName}`)
    } catch {
      toast.error('Không thể chặn người dùng')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mx-4 my-3 p-4 border border-border/80 bg-card rounded-[24px] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-all">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
          <MessageCircle className="size-5 text-accent" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">Yêu cầu tin nhắn người lạ</h4>
          <p className="text-xs text-muted-foreground">
            Bạn chưa kết bạn với <span className="font-semibold text-foreground">{otherUserName}</span>. 
            Tin nhắn mới sẽ ở trạng thái chờ cho đến khi bạn đồng ý kết nối.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBlock}
          disabled={loading !== null}
          className="rounded-full text-xs font-semibold px-4 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
        >
          {loading === 'block' ? (
            <Loader2 className="size-3 animate-spin mr-1.5" />
          ) : (
            <ShieldAlert className="size-3.5 mr-1.5" />
          )}
          Chặn người dùng
        </Button>
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={loading !== null}
          className="rounded-full text-xs font-semibold px-5 bg-gradient-to-r from-pon-cyan via-pon-peach to-pon-pink text-white hover:opacity-90 shadow-sm border-0"
        >
          {loading === 'accept' && <Loader2 className="size-3 animate-spin mr-1.5" />}
          Chấp nhận
        </Button>
      </div>
    </div>
  )
}
