'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { deviceLabel, supportsSpeakerSelection } from '@/lib/meetings/devices'
import type { MediaDeviceLists } from '@/lib/hooks/use-media-preview'

// Radix Select cannot hold '' as a value.
const DEFAULT = '__default__'

interface Props {
  devices: MediaDeviceLists
  audioInput?: string
  videoInput?: string
  audioOutput?: string
  /** '' = system default. */
  onSelect(kind: MediaDeviceKind, deviceId: string): void
  disabled?: boolean
}

interface FieldProps {
  kind: MediaDeviceKind
  label: string
  list: MediaDeviceInfo[]
  value?: string
  onSelect: Props['onSelect']
  disabled?: boolean
}

function DeviceField({ kind, label, list, value, onSelect, disabled }: FieldProps) {
  const t = useTranslations('meeting')
  const id = useId()
  // A remembered device that is gone shows as "System default".
  const current = value && list.some((d) => d.deviceId === value) ? value : DEFAULT
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select
        value={current}
        onValueChange={(v) => onSelect(kind, v === DEFAULT ? '' : v)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT}>{t('deviceDefault')}</SelectItem>
          {list.map((d, i) => (
            <SelectItem key={d.deviceId} value={d.deviceId}>
              {deviceLabel(d, i, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Microphone / camera / speaker pickers (pre-join screen and the in-room devices dialog). */
export function DeviceSelects({ devices, audioInput, videoInput, audioOutput, onSelect, disabled }: Props) {
  const t = useTranslations('meeting')
  const speakers = supportsSpeakerSelection()
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DeviceField
        kind="audioinput"
        label={t('deviceMic')}
        list={devices.audioinput}
        value={audioInput}
        onSelect={onSelect}
        disabled={disabled}
      />
      <DeviceField
        kind="videoinput"
        label={t('deviceCamera')}
        list={devices.videoinput}
        value={videoInput}
        onSelect={onSelect}
        disabled={disabled}
      />
      {speakers ? (
        <DeviceField
          kind="audiooutput"
          label={t('deviceSpeaker')}
          list={devices.audiooutput}
          value={audioOutput}
          onSelect={onSelect}
          disabled={disabled}
        />
      ) : null}
    </div>
  )
}
