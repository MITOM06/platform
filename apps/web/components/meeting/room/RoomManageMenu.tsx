'use client'

import { useId, useState } from 'react'
import { useNow, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Hand, Loader2, MicOff } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { HostAction } from '@/lib/api/meeting-types'
import { useUpdateMeeting } from '@/lib/hooks/use-meetings'
import { meetingErrorMessage } from '@/lib/meetings/meeting-errors'
import { roomControls } from '@/lib/meetings/permissions'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { MANAGE_SECTION_ID } from './ControlBarMore'
import { useRoom } from './room-context'
import { SectionTitle } from './SectionTitle'

/** A switch command counts as in flight until `meet.settings` confirms it, at most this long. */
const PENDING_MS = 8000

type SwitchLabel = 'settingLocked' | 'settingWaitingRoom' | 'settingScreenShare' | 'settingNotes'

function SettingSwitch({ label, checked, busy, onToggle }: {
  label: SwitchLabel
  checked: boolean
  busy: boolean
  onToggle(): void
}) {
  const t = useTranslations('meeting')
  const id = useId()
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4">
      <Label htmlFor={id} className="text-sm font-normal">
        {t(label)}
      </Label>
      <div className="flex items-center gap-2">
        {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden /> : null}
        <Switch id={id} checked={checked} disabled={busy} aria-busy={busy} onCheckedChange={onToggle} />
      </div>
    </div>
  )
}

/** Room-wide host controls at the end of the People panel (host / co-host only). */
export function RoomManageMenu({ anyHands }: { anyHands: boolean }) {
  const t = useTranslations('meeting')
  const { meeting, controller } = useRoom()
  const myRole = useMeetingRoomStore((s) => s.myRole)
  const pendingHost = useMeetingRoomStore((s) => s.pendingHost)
  const update = useUpdateMeeting(meeting.id)
  const [confirmMute, setConfirmMute] = useState(false)
  const anyPending = Object.keys(pendingHost).length > 0
  const now = useNow(anyPending ? { updateInterval: 1000 } : undefined).getTime()
  const rc = roomControls(myRole, meeting.settings, anyHands)
  if (!rc) return null

  const s = meeting.settings
  const pending = (...actions: HostAction[]) =>
    actions.some((a) => {
      const at = pendingHost[a]
      return at !== undefined && now - at < PENDING_MS
    })
  const toggleNotes = () =>
    update.mutate(
      { settings: { attendeesCanEditNotes: !s.attendeesCanEditNotes } },
      { onError: (err) => toast.error(meetingErrorMessage(err, t)) },
    )

  return (
    <section id={MANAGE_SECTION_ID} aria-labelledby="meeting-manage-title" className="scroll-mt-2 border-t border-border/60 pb-4">
      <SectionTitle id="meeting-manage-title">{t('manageTitle')}</SectionTitle>
      <div className="flex flex-wrap gap-2 px-4 py-2">
        <Button variant="outline" size="sm" onClick={() => setConfirmMute(true)}>
          <MicOff className="size-4" aria-hidden />
          {t('actionMuteAll')}
        </Button>
        {rc.lowerAllHands ? (
          <Button variant="outline" size="sm" onClick={() => controller.hostCommand('LOWER_ALL_HANDS')}>
            <Hand className="size-4" aria-hidden />
            {t('actionLowerAllHands')}
          </Button>
        ) : null}
      </div>
      <SettingSwitch label="settingLocked" checked={s.locked} busy={pending('LOCK', 'UNLOCK')} onToggle={() => controller.hostCommand(rc.lock)} />
      <SettingSwitch label="settingWaitingRoom" checked={s.waitingRoom} busy={pending('WAITING_ROOM_ON', 'WAITING_ROOM_OFF')} onToggle={() => controller.hostCommand(rc.waitingRoom)} />
      <SettingSwitch label="settingScreenShare" checked={s.allowAttendeeScreenShare} busy={pending('ATTENDEE_SCREEN_SHARE_ON', 'ATTENDEE_SCREEN_SHARE_OFF')} onToggle={() => controller.hostCommand(rc.screenShare)} />
      <SettingSwitch label="settingNotes" checked={s.attendeesCanEditNotes} busy={update.isPending} onToggle={toggleNotes} />
      <ConfirmDialog
        open={confirmMute}
        onOpenChange={setConfirmMute}
        title={t('muteAllConfirmTitle')}
        description={t('muteAllConfirmDesc')}
        confirmLabel={t('actionMuteAll')}
        onConfirm={() => controller.hostCommand('MUTE_ALL')}
      />
    </section>
  )
}
