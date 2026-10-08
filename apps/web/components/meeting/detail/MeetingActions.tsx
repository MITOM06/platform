'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CalendarX, Pencil, PhoneOff, Repeat, Video } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import type { Meeting } from '@/lib/api/meeting-types'
import { useHasCapability } from '@/lib/hooks/use-capabilities'
import { useCancelMeeting, useEndMeeting } from '@/lib/hooks/use-meetings'
import { meetingPath } from '@/lib/meetings/meeting-code'
import { meetingErrorMessage } from '@/lib/meetings/meeting-errors'
import { detailActions } from '@/lib/meetings/permissions'
import { MeetingFormDialog, type MeetingFormRequest } from '../MeetingFormDialog'

type Confirm = 'cancel' | 'end' | null

/** Join · Edit · Meet again · Cancel · End — whichever the viewer's role allows. */
export function MeetingActions({ meeting: m }: { meeting: Meeting }) {
  const t = useTranslations('meeting')
  const router = useRouter()
  const a = detailActions(m, useHasCapability('HOST_MEETING'))
  const [dialog, setDialog] = useState<MeetingFormRequest | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const cancel = useCancelMeeting(m)
  const end = useEndMeeting(m)

  const onCancel = () =>
    cancel.mutate(undefined, {
      onSuccess: () => toast.success(t('toastCancelled')),
      onError: (err) => toast.error(meetingErrorMessage(err, t)),
    })
  const onEnd = () =>
    end.mutate(undefined, {
      onSuccess: () => toast.success(t('toastEnded')),
      onError: (err) => toast.error(meetingErrorMessage(err, t)),
    })

  if (!a.join && !a.edit && !a.meetAgain && !a.cancel && !a.end) return null

  return (
    <div className="flex flex-wrap gap-2">
      {a.join ? (
        <Button onClick={() => router.push(meetingPath(m.code))} className="w-full sm:w-auto">
          <Video className="size-4" />
          {t('join')}
        </Button>
      ) : null}
      {a.meetAgain ? (
        <Button onClick={() => setDialog({ mode: 'again', meeting: m, now: new Date() })} className="w-full sm:w-auto">
          <Repeat className="size-4" />
          {t('meetAgain')}
        </Button>
      ) : null}
      {a.edit ? (
        <Button variant="outline" onClick={() => setDialog({ mode: 'edit', meeting: m, now: new Date() })}>
          <Pencil className="size-4" />
          {t('edit')}
        </Button>
      ) : null}
      {a.cancel ? (
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={cancel.isPending}
          onClick={() => setConfirm('cancel')}
        >
          <CalendarX className="size-4" />
          {t('cancelMeeting')}
        </Button>
      ) : null}
      {a.end ? (
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={end.isPending}
          onClick={() => setConfirm('end')}
        >
          <PhoneOff className="size-4" />
          {t('endMeeting')}
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirm === 'cancel'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('cancelConfirmTitle')}
        description={t('cancelConfirmDesc')}
        confirmLabel={t('cancelMeeting')}
        onConfirm={onCancel}
      />
      <ConfirmDialog
        open={confirm === 'end'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('endConfirmTitle')}
        description={t('endConfirmDesc')}
        confirmLabel={t('endMeeting')}
        onConfirm={onEnd}
      />
      <MeetingFormDialog request={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}
