'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Search, Loader2, Hash, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DialogA11yDescription } from '@/components/common/dialog-a11y-description'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { chatService } from '@/lib/api/chat'

interface Props {
  open: boolean
  onClose: () => void
}

export function PublicChannelsModal({ open, onClose }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = useTranslations('chat')
  const [search, setSearch] = useState('')
  const [joiningId, setJoiningId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['public-channels', search],
    queryFn: () => chatService.listPublicChannels(search || undefined),
    enabled: open,
    staleTime: 30_000,
  })

  const handleJoin = async (channelId: string) => {
    if (joiningId) return
    setJoiningId(channelId)
    try {
      const conv = await chatService.joinChannel(channelId)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      router.push(`/conversations/${conv.id}`)
      onClose()
      toast.success(t('publicChannelJoinSuccess'))
    } catch {
      toast.error(t('publicChannelJoinError'))
    } finally {
      setJoiningId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="size-5" />
            {t('publicChannelsTitle')}
          </DialogTitle>
        </DialogHeader>
          <DialogA11yDescription />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('publicChannelsSearchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="min-h-24 max-h-80 overflow-y-auto space-y-1 mt-1">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && data?.content.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {t('publicChannelsEmpty')}
            </p>
          )}
          {data?.content.map((channel) => {
            const isJoining = joiningId === channel.id
            return (
              <div
                key={channel.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Hash className="size-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{channel.name ?? t('publicChannelUnnamed')}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="size-3" />
                    {t('publicChannelMembers', { count: channel.participants.length })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleJoin(channel.id)}
                  disabled={!!joiningId}
                >
                  {isJoining ? <Loader2 className="size-4 animate-spin" /> : t('publicChannelJoin')}
                </Button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
