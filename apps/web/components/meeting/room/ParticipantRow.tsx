'use client'

import { useTranslations } from 'next-intl'
import { Hand, MicOff } from 'lucide-react'
import type { RosterEntry } from '@/lib/api/meeting-types'
import { safeDisplayName } from '@/lib/chat/names'
import { personActions } from '@/lib/meetings/permissions'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { PersonAvatar } from '../PersonAvatar'
import { HostMenu } from './HostMenu'
import { useRoom } from './room-context'

interface Props {
  entry: RosterEntry
  handRaised: boolean
}

/** One person in the People panel: avatar, name, role, mic / hand state, host menu. */
export function ParticipantRow({ entry, handRaised }: Props) {
  const t = useTranslations('meeting')
  const { myId, myName, myAvatarUrl } = useRoom()
  const isMe = entry.userId === myId
  const peer = useMeetingRoomStore((s) => (isMe ? undefined : s.peers.find((p) => p.identity === entry.userId)))
  const myMic = useMeetingRoomStore((s) => s.mic)
  const myRole = useMeetingRoomStore((s) => s.myRole)

  const name = isMe
    ? myName || t('you')
    : safeDisplayName(peer?.name, entry.userId) ?? safeDisplayName(entry.displayName, entry.userId) ?? t('participantFallback')
  const micOff = isMe ? !myMic : !!peer?.micMuted
  const actions = personActions(myRole, myId, { userId: entry.userId, role: entry.role, handRaised, micOn: !micOff })
  const role = entry.role === 'host' ? t('roleHost') : entry.role === 'cohost' ? t('roleCohost') : null

  return (
    <li className="flex min-h-12 items-center gap-3 px-4 py-1.5">
      <PersonAvatar name={name} avatarUrl={isMe ? myAvatarUrl : peer?.avatarUrl} className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{isMe && myName ? t('nameWithYou', { name: myName }) : name}</p>
        {role ? <p className="text-xs text-muted-foreground">{role}</p> : null}
      </div>
      {handRaised ? (
        <Hand className="size-4 shrink-0 text-primary" role="img" aria-label={t('handRaisedLabel')} />
      ) : null}
      {micOff ? (
        <MicOff className="size-4 shrink-0 text-muted-foreground" role="img" aria-label={t('micMutedLabel')} />
      ) : null}
      {actions.length ? <HostMenu userId={entry.userId} name={name} actions={actions} /> : null}
    </li>
  )
}
