'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DevicePrefs } from '@/lib/meetings/devices'

/**
 * Camera/mic preview of the meeting pre-join screen: one getUserMedia stream for
 * the chosen devices, the device lists, and why media is missing. Every state
 * update happens in a promise callback or an event handler (never synchronously
 * inside an effect). Browser error text never leaves this hook — only a kind.
 */

export type MediaPreviewError = 'blocked' | 'unavailable' | null

export interface MediaDeviceLists {
  audioinput: MediaDeviceInfo[]
  videoinput: MediaDeviceInfo[]
  audiooutput: MediaDeviceInfo[]
}

export interface MediaPreview {
  stream: MediaStream | null
  mic: boolean
  camera: boolean
  setMic(on: boolean): void
  setCamera(on: boolean): void
  devices: MediaDeviceLists
  audioInput?: string
  videoInput?: string
  audioOutput?: string
  selectDevice(kind: MediaDeviceKind, deviceId: string): void
  error: MediaPreviewError
  /** Stop every preview track (call before LiveKit captures the same devices). */
  release(): void
}

interface Capture {
  mic: boolean
  camera: boolean
  audioInput?: string
  videoInput?: string
}

const EMPTY: MediaDeviceLists = { audioinput: [], videoinput: [], audiooutput: [] }
const BLOCKED = new Set(['NotAllowedError', 'SecurityError'])

const hasMedia = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

async function openStream(c: Capture): Promise<MediaStream | null> {
  if (!hasMedia() || (!c.mic && !c.camera)) return null
  return navigator.mediaDevices.getUserMedia({
    audio: c.mic ? (c.audioInput ? { deviceId: c.audioInput } : true) : false,
    video: c.camera ? (c.videoInput ? { deviceId: c.videoInput } : true) : false,
  })
}

function errorKind(err: unknown): Exclude<MediaPreviewError, null> {
  const name = (err as { name?: unknown } | null)?.name
  return typeof name === 'string' && BLOCKED.has(name) ? 'blocked' : 'unavailable'
}

/** Best stream for `c`: both, else whichever of mic / camera still works (toggles follow). */
async function openBest(c: Capture): Promise<{ stream: MediaStream | null; capture: Capture; error: MediaPreviewError }> {
  try {
    return { stream: await openStream(c), capture: c, error: null }
  } catch (err) {
    const error = errorKind(err)
    for (const only of c.mic && c.camera ? [{ camera: false }, { mic: false }] : []) {
      try {
        const partial = { ...c, ...only }
        return { stream: await openStream(partial), capture: partial, error }
      } catch {
        // try the other one
      }
    }
    return { stream: null, capture: { ...c, mic: false, camera: false }, error }
  }
}

async function listDevices(): Promise<MediaDeviceLists> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return EMPTY
  const all = await navigator.mediaDevices.enumerateDevices()
  const of = (kind: MediaDeviceKind) => all.filter((d) => d.kind === kind && d.deviceId !== '')
  return { audioinput: of('audioinput'), videoinput: of('videoinput'), audiooutput: of('audiooutput') }
}

const stopAll = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop())

export function useMediaPreview(initial: DevicePrefs, active: boolean): MediaPreview {
  const [capture, setCapture] = useState<Capture>(() => ({
    mic: initial.micOn,
    camera: initial.camOn,
    audioInput: initial.audioInput,
    videoInput: initial.videoInput,
  }))
  const [audioOutput, setAudioOutput] = useState(initial.audioOutput)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [devices, setDevices] = useState<MediaDeviceLists>(EMPTY)
  const [error, setError] = useState<MediaPreviewError>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const seq = useRef(0)
  const captureRef = useRef(capture)

  // On failure keep the previous lists.
  const refreshDevices = useCallback(
    (): Promise<void> => listDevices().then(setDevices, () => undefined),
    [],
  )

  /** Drop any capture in flight and stop the current tracks (no state change). */
  const stopPreview = useCallback(() => {
    seq.current++
    stopAll(streamRef.current)
    streamRef.current = null
  }, [])

  const acquire = useCallback(
    async (c: Capture) => {
      const id = ++seq.current
      stopAll(streamRef.current)
      streamRef.current = null
      const { stream: next, capture: got, error: failed } = await openBest(c)
      if (id !== seq.current) {
        stopAll(next)
        return
      }
      streamRef.current = next
      setStream(next)
      setError(failed)
      if (got.mic !== c.mic || got.camera !== c.camera) {
        // Show what was actually captured, so the user knows what they join with.
        captureRef.current = got
        setCapture(got)
      }
      if (next) await refreshDevices()
    },
    [refreshDevices],
  )

  const release = useCallback(() => {
    stopPreview()
    setStream(null)
  }, [stopPreview])

  // Start (or stop) the preview with the screen; stop it on unmount.
  useEffect(() => {
    if (!active) return
    void acquire(captureRef.current)
    return stopPreview
  }, [active, acquire, stopPreview])

  // Device lists: once (labels may be empty before permission) and on plug/unplug.
  useEffect(() => {
    const md = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
    const onChange = () => void refreshDevices()
    md?.addEventListener?.('devicechange', onChange)
    void listDevices().then(setDevices, () => undefined)
    return () => md?.removeEventListener?.('devicechange', onChange)
  }, [refreshDevices])

  const update = useCallback(
    (patch: Partial<Capture>) => {
      captureRef.current = { ...captureRef.current, ...patch }
      setCapture(captureRef.current)
      if (active) void acquire(captureRef.current)
    },
    [active, acquire],
  )

  return {
    stream,
    mic: capture.mic,
    camera: capture.camera,
    setMic: (on) => update({ mic: on }),
    setCamera: (on) => update({ camera: on }),
    devices,
    audioInput: capture.audioInput,
    videoInput: capture.videoInput,
    audioOutput,
    selectDevice: (kind, deviceId) => {
      if (kind === 'audiooutput') setAudioOutput(deviceId || undefined)
      else update(kind === 'audioinput' ? { audioInput: deviceId || undefined } : { videoInput: deviceId || undefined })
    },
    error,
    release,
  }
}
