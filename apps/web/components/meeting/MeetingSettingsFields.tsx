'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { MeetingSettings } from '@/lib/api/meeting-types'

const ROWS: { key: keyof MeetingSettings; label: string; desc?: string }[] = [
  { key: 'waitingRoom', label: 'settingWaitingRoom', desc: 'settingWaitingRoomDesc' },
  { key: 'muteOnEntry', label: 'settingMuteOnEntry', desc: 'settingMuteOnEntryDesc' },
  { key: 'allowAttendeeScreenShare', label: 'settingScreenShare' },
  { key: 'attendeesCanEditNotes', label: 'settingNotes' },
  { key: 'locked', label: 'settingLocked', desc: 'settingLockedDesc' },
]

interface Props {
  settings: MeetingSettings
  onChange: (settings: MeetingSettings) => void
  disabled?: boolean
}

/** The five meeting options as labelled switches. */
export function MeetingSettingsFields({ settings, onChange, disabled }: Props) {
  const t = useTranslations('meeting')
  const baseId = useId()

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{t('settingsTitle')}</legend>
      {ROWS.map(({ key, label, desc }) => {
        const id = `${baseId}-${key}`
        return (
          <div key={key} className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={id} className="text-sm font-normal">
                {t(label)}
              </Label>
              {desc ? <p className="text-xs text-muted-foreground">{t(desc)}</p> : null}
            </div>
            <Switch
              id={id}
              checked={settings[key]}
              onCheckedChange={(checked) => onChange({ ...settings, [key]: checked })}
              disabled={disabled}
            />
          </div>
        )
      })}
    </fieldset>
  )
}
