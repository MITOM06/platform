'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Hand, MicOff, MoreVertical, ShieldMinus, ShieldPlus, UserX } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { HostAction } from '@/lib/api/meeting-types'
import type { LucideIcon } from 'lucide-react'
import { useRoom } from './room-context'

type PersonAction = Extract<HostAction, 'MUTE_MIC' | 'LOWER_HAND' | 'MAKE_COHOST' | 'REVOKE_COHOST' | 'REMOVE'>

const ITEMS: Record<PersonAction, { label: string; icon: LucideIcon }> = {
  MUTE_MIC: { label: 'actionMuteMic', icon: MicOff },
  LOWER_HAND: { label: 'actionLowerHand', icon: Hand },
  MAKE_COHOST: { label: 'actionMakeCohost', icon: ShieldPlus },
  REVOKE_COHOST: { label: 'actionRevokeCohost', icon: ShieldMinus },
  REMOVE: { label: 'actionRemove', icon: UserX },
}

const isPersonAction = (a: HostAction): a is PersonAction => a in ITEMS

interface Props {
  userId: string
  /** Already humanized (never an id). */
  name: string
  /** From personActions(); empty ⇒ the caller renders no menu. */
  actions: HostAction[]
}

/** Per-person host menu; removing someone asks first. Every action is a `/app/meet.host` command. */
export function HostMenu({ userId, name, actions }: Props) {
  const t = useTranslations('meeting')
  const { controller } = useRoom()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const items = actions.filter(isPersonAction)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={t('personMenu', { name })} title={t('personMenu', { name })}>
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {items.map((action) => {
            const { label, icon: Icon } = ITEMS[action]
            return (
              <DropdownMenuItem
                key={action}
                variant={action === 'REMOVE' ? 'destructive' : 'default'}
                onSelect={() => (action === 'REMOVE' ? setConfirmRemove(true) : controller.hostCommand(action, userId))}
              >
                <Icon aria-hidden />
                {t(label)}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t('removeConfirmTitle', { name })}
        description={t('removeConfirmDesc')}
        confirmLabel={t('actionRemove')}
        onConfirm={() => controller.hostCommand('REMOVE', userId)}
      />
    </>
  )
}
