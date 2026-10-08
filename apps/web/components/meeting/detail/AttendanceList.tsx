'use client'

import { useNow, useTranslations } from 'next-intl'
import type { Meeting } from '@/lib/api/meeting-types'
import { summarizeAttendance, type AttendanceSummary } from '@/lib/meetings/attendance'
import { personName } from '@/lib/meetings/display'
import { PersonAvatar } from '../PersonAvatar'

function AttendanceRow({ row }: { row: AttendanceSummary }) {
  const t = useTranslations('meeting')
  const name = personName(row, t('participantFallback'))
  const role = row.role === 'host' ? t('roleHost') : row.role === 'cohost' ? t('roleCohost') : null
  return (
    <li className="flex items-center gap-3 py-2">
      <PersonAvatar name={name} className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {name}
          {role ? <span className="ml-2 text-xs text-muted-foreground">{role}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('attendanceDuration', { minutes: Math.ceil(row.totalSeconds / 60) })}
          {row.sessions > 1 ? ` · ${t('attendanceSessions', { count: row.sessions })}` : null}
        </p>
      </div>
      {row.inside ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="size-2 rounded-full bg-online-green" />
          {t('attendanceInside')}
        </span>
      ) : null}
    </li>
  )
}

/** Who attended and for how long (open sessions tick while the meeting is LIVE). */
export function AttendanceList({ meeting: m }: { meeting: Meeting }) {
  const t = useTranslations('meeting')
  // Re-render every 30s so open sessions keep counting; ENDED meetings use endedAt.
  const now = useNow({ updateInterval: m.status === 'LIVE' ? 30_000 : undefined })
  const rows = summarizeAttendance(m.attendance, now, m.endedAt ?? m.cancelledAt)

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">{t('sectionAttendance')}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('attendanceEmpty')}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((row) => (
            <AttendanceRow key={row.userId} row={row} />
          ))}
        </ul>
      )}
    </section>
  )
}
