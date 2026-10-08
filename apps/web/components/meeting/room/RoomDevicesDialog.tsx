'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import type { MediaDeviceLists } from '@/lib/hooks/use-media-preview'
import { loadDevicePrefs, safeLocalStorage, saveDevicePrefs, type DevicePrefs } from '@/lib/meetings/devices'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'
import { DeviceSelects } from './DeviceSelects'
import { useRoom } from './room-context'

const EMPTY: MediaDeviceLists = { audioinput: [], videoinput: [], audiooutput: [] }

async function listDevices(): Promise<MediaDeviceLists> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return EMPTY
  const all = await navigator.mediaDevices.enumerateDevices()
  return {
    audioinput: all.filter((d) => d.kind === 'audioinput' && d.deviceId),
    videoinput: all.filter((d) => d.kind === 'videoinput' && d.deviceId),
    audiooutput: all.filter((d) => d.kind === 'audiooutput' && d.deviceId),
  }
}

/** Mounted only while the dialog is open: reads the device list + remembered choices fresh. */
function DevicesBody() {
  const { controller } = useRoom()
  const [devices, setDevices] = useState<MediaDeviceLists>(EMPTY)
  const [prefs, setPrefs] = useState<DevicePrefs>(() => {
    const stored = loadDevicePrefs(safeLocalStorage())
    return { ...stored, audioOutput: useMeetingRoomStore.getState().audioOutputId ?? stored.audioOutput }
  })

  useEffect(() => {
    let alive = true
    listDevices()
      .then((d) => alive && setDevices(d))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const select = (kind: MediaDeviceKind, deviceId: string) => {
    const id = deviceId || undefined
    const next: DevicePrefs = {
      ...prefs,
      ...(kind === 'audioinput' ? { audioInput: id } : kind === 'videoinput' ? { videoInput: id } : { audioOutput: id }),
    }
    setPrefs(next)
    const s = useMeetingRoomStore.getState()
    saveDevicePrefs({ ...next, micOn: s.mic, camOn: s.camera }, safeLocalStorage())
    if (kind === 'audiooutput') s.setAudioOutput(id)
    else void controller.switchDevice(kind, deviceId || 'default')
  }

  return (
    <DeviceSelects
      devices={devices}
      audioInput={prefs.audioInput}
      videoInput={prefs.videoInput}
      audioOutput={prefs.audioOutput}
      onSelect={select}
    />
  )
}

/** Change microphone / camera / speaker without leaving the room. */
export function RoomDevicesDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const t = useTranslations('meeting')
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={t('devicesTitle')} desktopClassName="sm:max-w-lg">
      {open ? <DevicesBody /> : null}
    </ResponsiveModal>
  )
}
