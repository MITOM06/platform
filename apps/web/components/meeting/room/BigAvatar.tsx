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

/** Large avatar for the room screens (pre-join camera-off, waiting): photo or first letter. */
export function BigAvatar({ name, avatarUrl, className }: Props) {
  return (
    <Avatar className={cn('size-20', className)}>
      {avatarUrl ? <AvatarImage src={absoluteMediaUrl(avatarUrl)} alt="" /> : null}
      <AvatarFallback className="text-2xl font-medium">{name.trim().charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
