import type { Translate } from './meeting-errors'

/**
 * Remembered microphone / camera / speaker choices for meetings. Storage can be
 * missing or throw (private mode, blocked site data) — every access is guarded
 * and falls back to "mic and camera on, system devices".
 */

export interface DevicePrefs {
  audioInput?: string
  videoInput?: string
  audioOutput?: string
  micOn: boolean
  camOn: boolean
}

export const DEVICE_PREFS_KEY = 'pon.meet.devices'

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined)

export function loadDevicePrefs(storage: Pick<Storage, 'getItem'> | null | undefined): DevicePrefs {
  const prefs: DevicePrefs = { micOn: true, camOn: true }
  let raw: string | null = null
  try {
    raw = storage?.getItem(DEVICE_PREFS_KEY) ?? null
  } catch {
    return prefs
  }
  if (!raw) return prefs
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return prefs
  }
  if (!parsed || typeof parsed !== 'object') return prefs
  const p = parsed as Record<string, unknown>
  const audioInput = str(p.audioInput)
  const videoInput = str(p.videoInput)
  const audioOutput = str(p.audioOutput)
  return {
    ...(audioInput ? { audioInput } : {}),
    ...(videoInput ? { videoInput } : {}),
    ...(audioOutput ? { audioOutput } : {}),
    micOn: typeof p.micOn === 'boolean' ? p.micOn : true,
    camOn: typeof p.camOn === 'boolean' ? p.camOn : true,
  }
}

export function saveDevicePrefs(prefs: DevicePrefs, storage: Pick<Storage, 'setItem'> | null | undefined): void {
  try {
    storage?.setItem(DEVICE_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // quota / blocked storage — the choice just isn't remembered
  }
}

/** The preferred device if it is still plugged in, else the first one. */
export function pickDeviceId(
  devices: Pick<MediaDeviceInfo, 'deviceId'>[],
  preferred?: string,
): string | undefined {
  if (preferred && devices.some((d) => d.deviceId === preferred)) return preferred
  return devices[0]?.deviceId
}

const UNNAMED: Record<MediaDeviceKind, string> = {
  audioinput: 'deviceUnnamedMic',
  videoinput: 'deviceUnnamedCamera',
  audiooutput: 'deviceUnnamedSpeaker',
}

/** The browser's label, or "Microphone 2" before permission is granted (`t` = `meeting`). */
export function deviceLabel(
  d: Pick<MediaDeviceInfo, 'label' | 'kind'>,
  index: number,
  t: Translate,
): string {
  return d.label || t(UNNAMED[d.kind], { n: index + 1 })
}

/** `window.localStorage`, or null on the server / when site data is blocked (the getter throws). */
export function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function supportsSpeakerSelection(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype
}

export function supportsScreenShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'
}
