'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Search, Users, Hash, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { chatService } from '@/lib/api/chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useDebounce } from '@/lib/hooks/use-debounce'

export default function ExplorePage() {
  const t = useTranslations('explore')
  const tc = useTranslations('common')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)

  const { data: response, isLoading } = useQuery({
    queryKey: ['public-channels', debouncedSearch],
    queryFn: () => chatService.listPublicChannels(debouncedSearch || undefined),
  })

  const joinMutation = useMutation({
    mutationFn: (id: string) => chatService.joinChannel(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success(t('joinSuccess'))
      router.push(`/conversations/${data.id}`)
    },
    onError: () => {
      toast.error(t('joinError'))
    },
  })

  const channels = response?.content || []

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="h-14 flex items-center px-4 border-b shrink-0 gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-semibold text-base">{t('title')}</span>
      </header>

      <div className="p-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="pl-9 bg-muted/50 border-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center">
              <Hash className="size-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? t('noResults') : t('noChannels')}
            </p>
          </div>
        ) : (
          channels.map((channel) => {
            const isJoining = joinMutation.isPending && joinMutation.variables === channel.id

            return (
              <div
                key={channel.id}
                className="flex items-center gap-4 p-4 rounded-2xl border bg-card hover:shadow-md transition-all group"
              >
                <Avatar className="size-14 shrink-0">
                  {channel.avatarUrl ? (
                    <AvatarImage src={channel.avatarUrl} alt={channel.name ?? ''} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-pon-cyan/10 text-pon-cyan text-lg">
                      <Hash className="size-6" />
                    </AvatarFallback>
                  )}
                </Avatar>

                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-semibold text-base truncate flex items-center gap-1.5">
                    {channel.name}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" />
                      {tc('members', { count: channel.participants.length })}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => joinMutation.mutate(channel.id)}
                  disabled={isJoining}
                  className="shrink-0 rounded-full px-5 bg-gradient-to-r from-pon-cyan to-pon-peach text-white font-medium shadow-sm hover:opacity-90"
                >
                  {isJoining ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="size-4 mr-2" />
                      {t('join')}
                    </>
                  )}
                </Button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
