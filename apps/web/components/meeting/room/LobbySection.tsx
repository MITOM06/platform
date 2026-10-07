'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import type { LobbyEntry } from '@/lib/api/meeting-types'
import { safeDisplayName } from '@/lib/chat/names'
import { PersonAvatar } from '../PersonAvatar'
import { useRoom } from './room-context'
import { SectionTitle } from './SectionTitle'

/** Who waits to be let in (host / co-host only): Admit / Deny each, Admit all from two people. */
export function LobbySection({ entries }: { entries: LobbyEntry[] }) {
  const t = useTranslations('meeting')
  const { controller } = useRoom()
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())

  const run = async (userIds: string[], call: (id: string) => Promise<void>) => {
    setPending((s) => new Set([...s, ...userIds]))
    for (const id of userIds) await call(id) // one at a time: errors are toasted by the controller
    setPending((s) => new Set([...s].filter((id) => !userIds.includes(id))))
  }

  if (!entries.length) return null
  return (
    <section aria-labelledby="meeting-lobby-title">
      <SectionTitle id="meeting-lobby-title" action={entries.length >= 2 ? (
        <Button variant="ghost" size="sm" disabled={pending.size > 0} onClick={() => void run(entries.map((e) => e.userId), (id) => controller.admit(id))}>
          {t('admitAll')}
        </Button>
      ) : null}>
        {t('sectionLobby', { count: entries.length })}
      </SectionTitle>
      <ul role="list">
        {entries.map((e) => {
          const name = safeDisplayName(e.displayName, e.userId) ?? t('participantFallback')
          const busy = pending.has(e.userId)
          return (
            <li key={e.userId} className="flex min-h-12 items-center gap-3 px-4 py-1.5">
              <PersonAvatar name={name} className="size-8" />
              <p className="min-w-0 flex-1 truncate text-sm">{name}</p>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void run([e.userId], (id) => controller.admit(id))}>
                {t('admit')}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run([e.userId], (id) => controller.deny(id))}>
                {t('deny')}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
