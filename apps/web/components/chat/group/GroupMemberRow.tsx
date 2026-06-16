'use client'

import { UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUser } from '@/lib/hooks/use-user'
import { absoluteMediaUrl } from '@/lib/media'

interface Props {
  uid: string
  isMemberAdmin: boolean
  canRemove: boolean
  onRemove: () => void
  saving: boolean
  adminLabel: string
}

/** Resolves a member's userId → display name + avatar (mirror Flutter group_info_screen). */
export function GroupMemberRow({
  uid,
  isMemberAdmin,
  canRemove,
  onRemove,
  saving,
  adminLabel,
}: Props) {
  const { data: user } = useUser(uid)
  const name = user?.displayName ?? '…'
  return (
    <div className="flex items-center gap-2 py-1">
      <Avatar className="size-7 shrink-0">
        {user?.avatarUrl && <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={name} />}
        <AvatarFallback className="text-xs">{(user?.displayName?.[0] ?? '?').toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{name}</p>
        {isMemberAdmin && <p className="text-[11px] text-pon-cyan">{adminLabel}</p>}
      </div>
      {canRemove && (
        <Button size="icon-xs" variant="ghost" onClick={onRemove} disabled={saving}>
          <UserMinus className="size-3.5 text-destructive" />
        </Button>
      )}
    </div>
  )
}
