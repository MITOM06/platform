'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import type { MeetingHand, RosterEntry } from '@/lib/api/meeting-types'
import { safeDisplayName } from '@/lib/chat/names'
import { useMeetingHands, useMeetingLobby, useMeetingRoster } from '@/lib/hooks/use-meetings'
import { isManager } from '@/lib/meetings/permissions'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { LobbySection } from './LobbySection'
import { ParticipantRow } from './ParticipantRow'
import { RoomManageMenu } from './RoomManageMenu'
import { useRoom } from './room-context'
import { SectionTitle } from './SectionTitle'

const RANK: Record<RosterEntry['role'], number> = { host: 0, cohost: 1, attendee: 2 }

/** Me first, then the host, co-hosts, everyone else in join order. */
function orderRoster(roster: RosterEntry[], myId: string): RosterEntry[] {
  return [...roster].sort((a, b) => {
    if (a.userId === myId) return -1
    if (b.userId === myId) return 1
    return RANK[a.role] - RANK[b.role] || a.joinedAt.localeCompare(b.joinedAt)
  })
}

/** Raised hands in the order they went up (earliest first); managers can lower them. */
function HandsSection({ hands, manager }: { hands: MeetingHand[]; manager: boolean }) {
  const t = useTranslations('meeting')
  const { controller, myId, myName } = useRoom()
  if (!hands.length) return null
  return (
    <section aria-labelledby="meeting-hands-title">
      <SectionTitle id="meeting-hands-title" action={manager ? (
        <Button variant="ghost" size="sm" onClick={() => controller.hostCommand('LOWER_ALL_HANDS')}>
          {t('actionLowerAllHands')}
        </Button>
      ) : null}>
        {t('sectionHands', { count: hands.length })}
      </SectionTitle>
      <ol role="list">
        {hands.map((h, i) => {
          const mine = h.userId === myId
          const name = mine ? myName || t('you') : safeDisplayName(h.displayName, h.userId) ?? t('participantFallback')
          return (
            <li key={h.userId} className="flex min-h-11 items-center gap-3 px-4 py-1">
              <span className="w-5 text-right text-sm tabular-nums text-muted-foreground">{i + 1}.</span>
              <p className="min-w-0 flex-1 truncate text-sm">{name}</p>
              {manager && !mine ? (
                <Button variant="ghost" size="sm" onClick={() => controller.hostCommand('LOWER_HAND', h.userId)}>
                  {t('actionLowerHand')}
                </Button>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** People panel: raised hands, waiting room (managers), everyone in the room, host controls. */
export function ParticipantsPanel() {
  const t = useTranslations('meeting')
  const { meeting, myId } = useRoom()
  const myRole = useMeetingRoomStore((s) => s.myRole)
  const manager = isManager(myRole)
  const roster = useMeetingRoster(meeting.id, true).data
  const hands = useMeetingHands(meeting.id, true).data ?? []
  const lobby = useMeetingLobby(meeting.id, manager).data ?? []
  const people = useMemo(() => orderRoster(roster ?? [], myId), [roster, myId])
  const raised = new Set(hands.map((h) => h.userId))

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <HandsSection hands={hands} manager={manager} />
      {manager ? <LobbySection entries={lobby} /> : null}
      <section aria-labelledby="meeting-people-title">
        <SectionTitle id="meeting-people-title">{t('sectionInMeeting', { count: people.length })}</SectionTitle>
        <ul role="list">
          {people.map((entry) => (
            <ParticipantRow key={entry.userId} entry={entry} handRaised={raised.has(entry.userId)} />
          ))}
        </ul>
      </section>
      <RoomManageMenu anyHands={hands.length > 0} />
    </div>
  )
}
