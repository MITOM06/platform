'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { MEETING_LIMITS, type Meeting } from '@/lib/api/meeting-types'
import { useCreateMeeting, useMeetingDepartmentOptions, useUpdateMeeting } from '@/lib/hooks/use-meetings'
import { refreshClaims } from '@/lib/realtime/claims'
import { meetingPath } from '@/lib/meetings/meeting-code'
import {
  meetingErrorKey,
  meetingErrorMessage,
  parseMeetingError,
  type MessageKey,
} from '@/lib/meetings/meeting-errors'
import {
  emptyMeetingForm,
  formFromMeeting,
  toMeetingInput,
  validateMeetingForm,
  type MeetingFormErrors,
  type MeetingFormField,
  type MeetingFormValues,
} from '@/lib/meetings/meeting-form'
import { InviteePicker } from './InviteePicker'
import { MeetingDepartmentField } from './MeetingDepartmentField'
import { MeetingScheduleFields } from './MeetingScheduleFields'
import { MeetingSettingsFields } from './MeetingSettingsFields'
import { MeetingTextFields } from './MeetingTextFields'

export type MeetingFormMode = 'create' | 'edit' | 'again'

/** What opens the dialog. `now` is taken in the click handler, never during render. */
export interface MeetingFormRequest {
  mode: MeetingFormMode
  meeting?: Meeting
  now: Date
}

const TITLE_KEYS: Record<MeetingFormMode, string> = {
  create: 'formCreateTitle',
  edit: 'formEditTitle',
  again: 'formAgainTitle',
}

/** Server `MEETING_INVALID.params.field` → the form field that shows it inline. */
const SERVER_FIELDS: Record<string, MeetingFormField> = {
  title: 'title',
  description: 'description',
  inviteeIds: 'invitees',
  scheduledStart: 'schedule',
  scheduledEnd: 'schedule',
}

function initialValues({ mode, meeting, now }: MeetingFormRequest): MeetingFormValues {
  if (meeting && mode !== 'create') return formFromMeeting(meeting, mode, now)
  return { ...emptyMeetingForm(now), scheduled: true }
}

export function MeetingFormDialog({ request, onClose }: { request: MeetingFormRequest | null; onClose: () => void }) {
  if (!request) return null
  return <MeetingFormDialogBody key={`${request.mode}:${request.meeting?.id ?? ''}`} request={request} onClose={onClose} />
}

function MeetingFormDialogBody({ request, onClose }: { request: MeetingFormRequest; onClose: () => void }) {
  const t = useTranslations('meeting')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const queryClient = useQueryClient()
  const { mode, now } = request
  const original = mode === 'edit' ? request.meeting : undefined
  const [values, setValues] = useState(() => initialValues(request))
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)
  const [serverErrors, setServerErrors] = useState<MeetingFormErrors>({})
  const create = useCreateMeeting()
  const update = useUpdateMeeting(original?.id ?? '')
  const pending = create.isPending || update.isPending
  const departments = useMeetingDepartmentOptions()

  const errors: MeetingFormErrors = {
    ...(checkedAt ? validateMeetingForm(values, checkedAt, original) : {}),
    ...serverErrors,
  }
  const msg = (k?: MessageKey) => (k ? t(k.key, k.values) : undefined)
  const patch = (field: MeetingFormField | null, next: Partial<MeetingFormValues>) => {
    setValues((v) => ({ ...v, ...next }))
    if (field) {
      setServerErrors((e) => {
        if (!(field in e)) return e
        const rest = { ...e }
        delete rest[field]
        return rest
      })
    }
  }

  const onError = (err: unknown) => {
    const info = parseMeetingError(err)
    const field = info.code === 'MEETING_INVALID' ? SERVER_FIELDS[String(info.params?.field)] : undefined
    if (field) {
      setServerErrors((e) => ({ ...e, [field]: meetingErrorKey(info) }))
      return
    }
    if (info.code === 'MEETING_CREATE_FORBIDDEN') void refreshClaims(queryClient)
    toast.error(meetingErrorMessage(err, t))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const at = new Date()
    setCheckedAt(at)
    if (Object.keys(validateMeetingForm(values, at, original)).length) return
    if (original) {
      update.mutate(toMeetingInput(values, original), {
        onSuccess: () => {
          toast.success(t('toastUpdated'))
          onClose()
        },
        onError,
      })
      return
    }
    create.mutate(toMeetingInput(values), {
      onSuccess: (m) => {
        onClose()
        if (values.scheduled) toast.success(t('toastCreated'))
        else router.push(meetingPath(m.code))
      },
      onError,
    })
  }

  const showDepartment =
    departments.length > 0 &&
    (!values.departmentId || departments.some((d) => d.id === values.departmentId))
  const submitLabel = original ? t('submitSave') : values.scheduled ? t('submitCreate') : t('submitStartNow')

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(TITLE_KEYS[mode])}
      desktopClassName="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" form="meeting-form" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="meeting-form" onSubmit={submit} noValidate className="max-h-[60dvh] space-y-5 overflow-y-auto px-0.5">
        <MeetingTextFields
          title={values.title}
          description={values.description}
          onTitle={(title) => patch('title', { title })}
          onDescription={(description) => patch('description', { description })}
          titleError={msg(errors.title)}
          descriptionError={msg(errors.description)}
          limits={{ title: MEETING_LIMITS.title, description: MEETING_LIMITS.description }}
        />
        <MeetingScheduleFields
          scheduled={values.scheduled}
          schedule={values.schedule}
          onScheduledChange={(scheduled) => patch('schedule', { scheduled })}
          onScheduleChange={(schedule) => patch('schedule', { schedule })}
          allowNow={!original?.scheduledStart}
          disabled={original?.status === 'LIVE'}
          error={msg(errors.schedule)}
          now={now}
        />
        <InviteePicker
          invitees={values.invitees}
          onChange={(invitees) => patch('invitees', { invitees })}
          error={msg(errors.invitees)}
        />
        {showDepartment ? (
          <MeetingDepartmentField
            value={values.departmentId}
            onChange={(departmentId) => patch(null, { departmentId })}
            departments={departments}
          />
        ) : null}
        <MeetingSettingsFields
          settings={values.settings}
          onChange={(settings) => patch(null, { settings })}
        />
      </form>
    </ResponsiveModal>
  )
}
