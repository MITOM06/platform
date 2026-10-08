'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Loader2, Video } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useHasCapability } from '@/lib/hooks/use-capabilities'
import { useCreateMeeting } from '@/lib/hooks/use-meetings'
import { refreshClaims } from '@/lib/realtime/claims'
import { meetingPath } from '@/lib/meetings/meeting-code'
import { meetingErrorMessage, parseMeetingError } from '@/lib/meetings/meeting-errors'
import { JoinByCodeForm } from './JoinByCodeForm'

/** Title, "Start a meeting" / "Schedule" (HOST_MEETING only) and join-by-code. */
export function MeetingsHeader({ onSchedule }: { onSchedule: () => void }) {
  const t = useTranslations('meeting')
  const router = useRouter()
  const queryClient = useQueryClient()
  const canHost = useHasCapability('HOST_MEETING')
  const create = useCreateMeeting()

  const startNow = () =>
    create.mutate(
      {},
      {
        onSuccess: (m) => router.push(meetingPath(m.code)),
        onError: (err) => {
          // A stale claim: the role lost HOST_MEETING — refresh so the buttons disappear.
          if (parseMeetingError(err).code === 'MEETING_CREATE_FORBIDDEN') void refreshClaims(queryClient)
          toast.error(meetingErrorMessage(err, t))
        },
      },
    )

  return (
    <header className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        {canHost ? (
          <div className="flex gap-2">
            <Button onClick={startNow} disabled={create.isPending} className="flex-1 md:flex-none">
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
              {create.isPending ? t('starting') : t('newInstant')}
            </Button>
            <Button variant="outline" onClick={onSchedule} className="flex-1 md:flex-none">
              <CalendarPlus className="size-4" />
              {t('newScheduled')}
            </Button>
          </div>
        ) : null}
        <JoinByCodeForm className="w-full md:max-w-sm md:ml-auto" />
      </div>
    </header>
  )
}
