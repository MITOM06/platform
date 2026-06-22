'use client'

import { useQuery } from '@tanstack/react-query'
import { authService } from '@/lib/api/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { absoluteMediaUrl } from '@/lib/media'

export function ActiveFriendsRow() {
  const { data: activeFriends = [] } = useQuery({
    queryKey: ['onlineFriends'],
    queryFn: () => authService.getOnlineFriends(),
    staleTime: 60_000,
  })

  if (activeFriends.length === 0) return null

  return (
    <div className="border-b py-3 px-2 bg-background/50">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-4 px-2">
          {activeFriends.map((friend) => (
            <div key={friend.id || friend._id} className="flex flex-col items-center gap-1.5 cursor-pointer group">
              <div className="relative">
                <Avatar className="size-12 ring-2 ring-transparent transition-all group-hover:ring-pon-cyan/50">
                  <AvatarImage src={friend.avatarUrl ? absoluteMediaUrl(friend.avatarUrl) : undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-pon-cyan/80 to-pon-peach/80 text-white font-medium">
                    {friend.displayName[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 size-3.5 bg-green-500 rounded-full border-2 border-background" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground w-12 truncate text-center group-hover:text-foreground transition-colors">
                {friend.displayName.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </div>
  )
}
