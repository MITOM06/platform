'use client'

import { useTranslations } from 'next-intl'
import { MoreHorizontal, ShieldCheck, ShieldOff, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUser } from '@/lib/hooks/use-user'
import { isHumanUserId, useSenderDisplayName } from '@/lib/hooks/use-display-names'
import { absoluteMediaUrl } from '@/lib/media'

interface Props {
  uid: string
  conversationId: string
  isMemberAdmin: boolean
  isSelf: boolean
  canRemove: boolean
  onRemove: () => void
  /** Viewer is an admin and may promote this member (F4). */
  canPromote?: boolean
  /** Viewer is an admin and may demote this admin (never the last one). */
  canDemote?: boolean
  onPromote?: () => void
  onDemote?: () => void
  saving: boolean
  adminLabel: string
}

/**
 * Resolves a member's userId → display name + avatar (mirror Flutter
 * group_info_screen), with the admin badge and the admin-only actions
 * (make / remove admin, remove from group).
 */
export function GroupMemberRow({
  uid,
  conversationId,
  isMemberAdmin,
  isSelf,
  canRemove,
  onRemove,
  canPromote = false,
  canDemote = false,
  onPromote,
  onDemote,
  saving,
  adminLabel,
}: Props) {
  const t = useTranslations('chat')
  const { data: user } = useUser(isHumanUserId(uid) ? uid : undefined)
  const resolved = useSenderDisplayName(uid, conversationId, !isSelf)
  const name = isSelf ? t('you') : resolved || '…'
  const hasMenu = canPromote || canDemote

  return (
    <div className="flex items-center gap-2 py-1">
      <Avatar className="size-7 shrink-0">
        {user?.avatarUrl && <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={name} />}
        <AvatarFallback className="text-xs">{(name[0] ?? '?').toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{name}</p>
        {isMemberAdmin && (
          <p className="flex items-center gap-1 text-[11px] text-primary">
            <ShieldCheck className="size-3" aria-hidden />
            {adminLabel}
          </p>
        )}
      </div>
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              disabled={saving}
              aria-label={t('groupMemberActions', { name })}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            {canPromote && (
              <DropdownMenuItem onClick={onPromote}>
                <ShieldCheck className="size-4" />
                {t('groupMakeAdmin')}
              </DropdownMenuItem>
            )}
            {canDemote && (
              <DropdownMenuItem onClick={onDemote}>
                <ShieldOff className="size-4" />
                {t('groupRemoveAdmin')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {canRemove && (
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onRemove}
          disabled={saving}
          aria-label={t('groupRemoveMember', { name })}
        >
          <UserMinus className="size-3.5 text-destructive" />
        </Button>
      )}
    </div>
  )
}
