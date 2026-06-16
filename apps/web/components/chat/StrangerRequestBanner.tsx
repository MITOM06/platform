'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('chat')
  const [loading, setLoading] = useState<'accept' | 'block' | null>(null)

  const handleAccept = async () => {
    setLoading('accept')
    try {
      await chatService.acceptConversation(conversationId)
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      onAccepted()
      toast.success(t('strangerAcceptSuccess', { name: otherUserName }))
    } catch {
      toast.error(t('strangerAcceptError'))
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
      toast.success(t('strangerBlockSuccess', { name: otherUserName }))
    } catch {
      toast.error(t('strangerBlockError'))
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
          <h4 className="text-sm font-semibold text-foreground">{t('strangerRequestTitle')}</h4>
          <p className="text-xs text-muted-foreground">
            {t('strangerRequestBody', { name: otherUserName })}
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
          {t('strangerBlock')}
        </Button>
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={loading !== null}
          className="rounded-full text-xs font-semibold px-5 bg-gradient-to-r from-pon-cyan via-pon-peach to-pon-pink text-white hover:opacity-90 shadow-sm border-0"
        >
          {loading === 'accept' && <Loader2 className="size-3 animate-spin mr-1.5" />}
          {t('strangerAccept')}
        </Button>
      </div>
    </div>
  )
}
