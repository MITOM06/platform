'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  AlertCircle,
  Ban,
  CloudOff,
  Lock,
  LogOut,
  SearchX,
  UserX,
  Users,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MEETING_LIMITS } from '@/lib/api/meeting-types'
import { canRejoin } from '@/lib/meetings/room-phase'

export type RoomStatusKind =
  | 'notFound'
  | 'denied'
  | 'removed'
  | 'locked'
  | 'full'
  | 'unavailable'
  | 'left'
  | 'connectionLost'
  | 'error'

interface Props {
  kind: RoomStatusKind
  meetingId?: string
  onRetry?: () => void
}

const SCREENS: Record<RoomStatusKind, { icon: LucideIcon; title: string; desc?: string }> = {
  notFound: { icon: SearchX, title: 'notFoundTitle', desc: 'notFoundDesc' },
  denied: { icon: Ban, title: 'deniedTitle', desc: 'deniedDesc' },
  removed: { icon: UserX, title: 'removedTitle', desc: 'removedDesc' },
  locked: { icon: Lock, title: 'lockedTitle', desc: 'lockedDesc' },
  full: { icon: Users, title: 'fullTitle', desc: 'fullDesc' },
  unavailable: { icon: CloudOff, title: 'unavailableTitle', desc: 'unavailableDesc' },
  left: { icon: LogOut, title: 'leftTitle' },
  connectionLost: { icon: WifiOff, title: 'connectionLostTitle', desc: 'connectionLostDesc' },
  error: { icon: AlertCircle, title: 'errGeneric' },
}

/** Full-screen outcome of the meeting page (denied, removed, locked, full, left…). */
export function RoomStatusScreen({ kind, meetingId, onRetry }: Props) {
  const t = useTranslations('meeting')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { icon: Icon, title, desc } = SCREENS[kind]

  // Screen readers announce the outcome right away.
  useEffect(() => {
    headingRef.current?.focus()
  }, [kind])

  const retry = canRejoin(kind) && onRetry
  const retryLabel = kind === 'left' || kind === 'connectionLost' ? t('rejoin') : t('tryAgain')

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1.5">
          <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
            {t(title)}
          </h1>
          {desc ? (
            <p className="text-sm text-muted-foreground">
              {t(desc, { max: MEETING_LIMITS.participants })}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2">
          {retry ? (
            <Button className="w-full" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {meetingId && kind !== 'notFound' ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/meetings/${encodeURIComponent(meetingId)}`}>{t('viewDetails')}</Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" className="w-full">
            <Link href="/meetings">{t('backToList')}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
