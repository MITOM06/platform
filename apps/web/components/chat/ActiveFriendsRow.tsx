'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { authService } from '@/lib/api/auth'
import { chatService } from '@/lib/api/chat'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import axios from 'axios'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export function ActiveFriendsRow() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [startingId, setStartingId] = useState<string | null>(null)

  const { data: onlineFriends, isLoading } = useQuery({
    queryKey: ['online-friends'],
    queryFn: () => authService.getOnlineFriends(),
    refetchInterval: 15_000,
  })

  const handleSelectFriend = async (friendId: string) => {
    if (startingId) return
    setStartingId(friendId)
    try {
      const conv = await chatService.createConversation(friendId)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      router.push(`/conversations/${conv.id}`)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const body = err.response.data as { conversationId?: string }
        if (body.conversationId) {
          router.push(`/conversations/${body.conversationId}`)
          return
        }
      }
      toast.error('Không thể bắt đầu trò chuyện')
    } finally {
      setStartingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 px-4 py-3 overflow-x-auto shrink-0 border-b scrollbar-none">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 animate-pulse min-w-[64px]">
            <div className="size-12 rounded-full bg-muted" />
            <div className="h-3 w-10 bg-muted rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!onlineFriends || onlineFriends.length === 0) {
    return null
  }

  return (
    <div className="flex gap-4 px-4 py-3 overflow-x-auto shrink-0 border-b scrollbar-none select-none bg-background/50">
      {onlineFriends.map((friend) => {
        const friendId = friend._id || friend.id || ''
        const displayName = friend.displayName || ''
        const initials = getInitials(displayName)
        const isStarting = startingId === friendId

        // Extract first name or limit characters
        const firstName = displayName.split(' ').pop() || displayName
        const displayNameTruncated = firstName.length > 8 ? firstName.substring(0, 7) + '..' : firstName

        return (
          <button
            key={friendId}
            onClick={() => handleSelectFriend(friendId)}
            disabled={!!startingId}
            className="flex flex-col items-center gap-1.5 min-w-[64px] group relative focus:outline-none transition-transform active:scale-95"
            title={displayName}
          >
            <div className="relative">
              <Avatar className="size-12 border-2 border-background group-hover:border-primary/50 transition-colors">
                {friend.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={friend.avatarUrl}
                    alt={displayName}
                    className="size-full object-cover rounded-full"
                  />
                ) : (
                  <AvatarFallback className="text-xs font-semibold bg-muted text-muted-foreground">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <span className="absolute bottom-0.5 right-0.5 size-3 rounded-full bg-online-green border-2 border-background animate-pulse" />
              {isStarting && (
                <div className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-foreground/80 group-hover:text-primary transition-colors truncate max-w-[64px]">
              {displayNameTruncated}
            </span>
          </button>
        )
      })}
    </div>
  )
}
