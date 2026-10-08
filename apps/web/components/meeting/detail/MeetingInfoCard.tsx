'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Building2, Clock } from 'lucide-react'
import type { Meeting, MeetingPerson } from '@/lib/api/meeting-types'
import { useMeetingDepartmentOptions } from '@/lib/hooks/use-meetings'
import { personName } from '@/lib/meetings/display'
import { formatMeetingRange } from '@/lib/meetings/schedule'
import { CopyLinkButton } from '../CopyLinkButton'
import { PersonAvatar } from '../PersonAvatar'

const MAX_INVITEES_SHOWN = 8

function PersonLine({ person, role }: { person: MeetingPerson; role?: string }) {
  const t = useTranslations('meeting')
  const name = personName(person, t('participantFallback'))
  return (
    <li className="flex items-center gap-2 text-sm">
      <PersonAvatar name={name} avatarUrl={person.avatarUrl} />
      <span className="min-w-0 truncate">{name}</span>
      {role ? <span className="text-xs text-muted-foreground">{role}</span> : null}
    </li>
  )
}

function PeopleGroup({ label, people, role }: { label: string; people: MeetingPerson[]; role?: string }) {
  const t = useTranslations('meeting')
  if (!people.length) return null
  const shown = people.slice(0, MAX_INVITEES_SHOWN)
  const more = people.length - shown.length
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="space-y-1.5">
        {shown.map((p) => (
          <PersonLine key={p.userId} person={p} role={role} />
        ))}
      </ul>
      {more > 0 ? <p className="text-xs text-muted-foreground">{t('moreCount', { count: more })}</p> : null}
    </div>
  )
}

/** Department name from the departments the caller can see (gap B1), else a generic label — never the id. */
function DepartmentLine({ departmentId }: { departmentId: string }) {
  const t = useTranslations('meeting')
  const departments = useMeetingDepartmentOptions()
  const name = departments.find((d) => d.id === departmentId)?.name ?? t('departmentGeneric')
  return (
    <p className="flex items-center gap-2 text-sm">
      <Building2 className="size-4 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">{t('fieldDepartment')}:</span>
      <span className="min-w-0 truncate">{name}</span>
    </p>
  )
}

export function MeetingInfoCard({ meeting: m }: { meeting: Meeting }) {
  const t = useTranslations('meeting')
  const locale = useLocale()
  const when = m.scheduledStart
    ? formatMeetingRange(locale, m.scheduledStart, m.scheduledEnd)
    : `${t('instantMeeting')} · ${t('createdAt', { time: formatMeetingRange(locale, m.createdAt) })}`

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm">
        <Clock className="size-4 text-muted-foreground" aria-hidden />
        <span>{when}</span>
      </p>
      {m.status !== 'ENDED' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('meetingCode')}</span>
          <span className="font-mono text-sm">{m.code}</span>
          <CopyLinkButton code={m.code} variant="button" />
        </div>
      ) : null}
      {m.description?.trim() ? (
        <p className="whitespace-pre-wrap break-words text-sm">{m.description}</p>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t('sectionPeople')}</h2>
        <ul>
          <PersonLine person={m.host} role={t('roleHost')} />
        </ul>
        <PeopleGroup label={t('coHosts')} people={m.coHosts ?? []} role={t('roleCohost')} />
        <PeopleGroup label={t('invitees')} people={m.invitees ?? []} />
        {m.departmentId ? <DepartmentLine departmentId={m.departmentId} /> : null}
      </section>
    </div>
  )
}
