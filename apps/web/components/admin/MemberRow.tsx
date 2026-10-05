'use client'

import { useTranslations } from 'next-intl'
import { Ban, Brain, LockOpen, Pencil, ShieldCheck, ShieldOff } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Member } from '@/lib/api/admin-types'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

interface Props {
  member: Member
  roleName?: string
  /** The signed-in admin's own row — the block action is hidden. */
  isSelf: boolean
  canManageMembers: boolean
  /** Owner viewing another privileged member — "Reset 2FA" is offered (see `canResetMemberMfa`). */
  canResetMfa: boolean
  onEdit: (m: Member) => void
  onAiContext: (m: Member) => void
  onToggleBlock: (m: Member) => void
  onResetMfa: (m: Member) => void
}

/** One row of the admin members list. */
export function MemberRow({
  member: m,
  roleName,
  isSelf,
  canManageMembers,
  canResetMfa,
  onEdit,
  onAiContext,
  onToggleBlock,
  onResetMfa,
}: Props) {
  const t = useTranslations('admin')
  const blocked = m.status === 'blocked'

  return (
    <div
      data-testid="member-row"
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${blocked ? 'opacity-70' : ''}`}
    >
      <Avatar className="size-9">
        <AvatarFallback className="text-xs bg-primary/10 text-primary">
          {initials(m.displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{m.displayName}</p>
        <p className="text-sm text-muted-foreground truncate">{m.email}</p>
      </div>
      {blocked && <Badge variant="destructive">{t('memberStatusBlocked')}</Badge>}
      {m.mfaEnabled && (
        <Badge variant="outline" className="gap-1" data-testid="member-mfa-badge">
          <ShieldCheck className="size-3" aria-hidden />
          {t('memberMfaOn')}
        </Badge>
      )}
      {roleName && <Badge variant="secondary">{roleName}</Badge>}
      {canManageMembers && (
        <Button
          variant="ghost"
          size="icon"
          className="tap"
          title={t('editAiContext')}
          onClick={() => onAiContext(m)}
        >
          <Brain className="size-4" />
        </Button>
      )}
      {canManageMembers && !isSelf && (
        <Button
          variant="ghost"
          size="icon"
          className="tap"
          title={t(blocked ? 'memberUnblock' : 'memberBlock')}
          aria-label={t(blocked ? 'memberUnblock' : 'memberBlock')}
          onClick={() => onToggleBlock(m)}
        >
          {blocked ? <LockOpen className="size-4" /> : <Ban className="size-4" />}
        </Button>
      )}
      {canResetMfa && (
        <Button
          variant="ghost"
          size="icon"
          className="tap"
          title={t('memberMfaReset')}
          aria-label={t('memberMfaReset')}
          onClick={() => onResetMfa(m)}
        >
          <ShieldOff className="size-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="tap" onClick={() => onEdit(m)}>
        <Pencil className="size-4" />
      </Button>
    </div>
  )
}
