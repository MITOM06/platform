'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { absoluteMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

interface Props {
  /** Already humanized (never an id). */
  name: string
  avatarUrl?: string | null
  className?: string
}

/** Small avatar for meeting people: photo when known, else the first letter of the name. */
export function PersonAvatar({ name, avatarUrl, className }: Props) {
  return (
    <Avatar className={cn('size-6', className)}>
      {avatarUrl ? <AvatarImage src={absoluteMediaUrl(avatarUrl)} alt="" /> : null}
      <AvatarFallback className="text-[10px] font-medium">
        {name.trim().charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
