'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUser } from '@/lib/hooks/use-user'
import { absoluteMediaUrl } from '@/lib/media'

interface Props {
  open: boolean
  onClose: () => void
  /** Participants whose nicknames can be edited (self + others). */
  participantIds: string[]
  currentUserId: string
  /** Current nickname per userId (empty/undefined = none). */
  nicknames: Record<string, string>
  /** Persist a nickname (caller broadcasts the system message). */
  onSave: (userId: string, value: string) => void
  saving: boolean
}

function getInitial(name?: string): string {
  return name?.[0]?.toUpperCase() ?? '?'
}

/**
 * Centered modal listing each participant as a row: avatar + real account
 * displayName, with the editable nickname (pencil → inline input) below.
 * Mirrors Flutter `showNicknamesDialog` redesign. Storage/transport unchanged
 * (client-local + `system.nickname.changed:` broadcast).
 */
export function NicknamesModal({
  open,
  onClose,
  participantIds,
  currentUserId,
  nicknames,
  onSave,
  saving,
}: Props) {
  const t = useTranslations('chat')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('nicknameModalTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {participantIds.map((uid) => (
            <NicknameParticipantRow
              key={uid}
              userId={uid}
              isSelf={uid === currentUserId}
              nickname={nicknames[uid] ?? ''}
              onSave={(value) => onSave(uid, value)}
              saving={saving}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NicknameParticipantRow({
  userId,
  isSelf,
  nickname,
  onSave,
  saving,
}: {
  userId: string
  isSelf: boolean
  nickname: string
  onSave: (value: string) => void
  saving: boolean
}) {
  const t = useTranslations('chat')
  const { data: user } = useUser(userId)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(nickname)

  const accountName = user?.displayName ?? t('conversationDefault')
  const displayedName = isSelf ? `${accountName} (${t('nicknameYou')})` : accountName

  const handleSave = () => {
    onSave(value.trim())
    setEditing(false)
  }

  const handleCancel = () => {
    setValue(nickname)
    setEditing(false)
  }

  return (
    <div className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/40">
      <Avatar className="size-10 shrink-0">
        {user?.avatarUrl && <AvatarImage src={absoluteMediaUrl(user.avatarUrl)} alt={accountName} />}
        <AvatarFallback className="text-sm font-medium bg-gradient-to-br from-pon-cyan/80 to-pon-peach/80 text-white">
          {getInitial(user?.displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{displayedName}</p>

        {editing ? (
          <div className="flex gap-2 mt-1.5">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('nicknamePlaceholder')}
              maxLength={40}
              autoFocus
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
            />
            <Button size="icon-sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={handleCancel} disabled={saving}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setValue(nickname); setEditing(true) }}
            className="flex items-center gap-1.5 mt-0.5 text-left group/edit"
          >
            <span
              className={nickname
                ? 'text-sm text-pon-cyan'
                : 'text-sm text-muted-foreground italic'}
            >
              {nickname || t('nicknameNonePlaceholder')}
            </span>
            <Pencil className="size-3 text-muted-foreground opacity-60 group-hover/edit:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  )
}
