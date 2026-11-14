import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useMediaPreview } from '@/lib/hooks/use-media-preview'

type Constraints = { audio: unknown; video: unknown }
const fakeStream = (label: string) => {
  const tracks = [{ stop: vi.fn() }]
  return { label, getTracks: () => tracks, tracks } as unknown as MediaStream & { tracks: { stop: ReturnType<typeof vi.fn> }[] }
}
const dev = (kind: string, deviceId: string) => ({ kind, deviceId, label: deviceId }) as MediaDeviceInfo

let gum: ReturnType<typeof vi.fn>
let enumerate: ReturnType<typeof vi.fn>
let listeners: Record<string, () => void>
const original = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')

beforeEach(() => {
  gum = vi.fn(async (_c: Constraints) => fakeStream('s'))
  enumerate = vi.fn(async () => [dev('audioinput', 'mic1'), dev('videoinput', 'cam1'), dev('audiooutput', 'spk1'), dev('audioinput', '')])
  listeners = {}
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: gum,
      enumerateDevices: enumerate,
      addEventListener: (ev: string, fn: () => void) => { listeners[ev] = fn },
      removeEventListener: vi.fn((ev: string) => { delete listeners[ev] }),
    },
  })
})
afterEach(() => {
  if (original) Object.defineProperty(navigator, 'mediaDevices', original)
  else delete (navigator as unknown as Record<string, unknown>).mediaDevices
})

const prefs = { micOn: true, camOn: true }

describe('useMediaPreview', () => {
  it('opens both devices when active and lists devices without empty ids', async () => {
    const { result } = renderHook(() => useMediaPreview(prefs, true))
    await waitFor(() => expect(result.current.stream).not.toBeNull())
    expect(gum).toHaveBeenCalledWith({ audio: true, video: true })
    await waitFor(() => expect(result.current.devices.audioinput.map((d) => d.deviceId)).toEqual(['mic1']))
    expect(result.current.devices.videoinput.map((d) => d.deviceId)).toEqual(['cam1'])
    expect(result.current.devices.audiooutput.map((d) => d.deviceId)).toEqual(['spk1'])
    expect(result.current.error).toBeNull()
    expect(result.current.mic).toBe(true)
    expect(result.current.camera).toBe(true)
  })

  it('does not capture when inactive but still lists devices', async () => {
    const { result } = renderHook(() => useMediaPreview(prefs, false))
    await waitFor(() => expect(result.current.devices.audioinput).toHaveLength(1))
    expect(gum).not.toHaveBeenCalled()
    expect(result.current.stream).toBeNull()
  })

  it('uses chosen device ids as constraints', async () => {
    renderHook(() => useMediaPreview({ ...prefs, audioInput: 'mic1', videoInput: 'cam1' }, true))
    await waitFor(() => expect(gum).toHaveBeenCalledWith({ audio: { deviceId: 'mic1' }, video: { deviceId: 'cam1' } }))
  })

  it('opens nothing when both toggles are off', async () => {
    const { result } = renderHook(() => useMediaPreview({ micOn: false, camOn: false }, true))
    await waitFor(() => expect(enumerate).toHaveBeenCalled())
    expect(gum).not.toHaveBeenCalled()
    expect(result.current.stream).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('falls back to mic-only when the camera fails, and flags the toggle', async () => {
    gum.mockImplementation(async (c: Constraints) => {
      if (c.video) throw Object.assign(new Error('busy'), { name: 'NotReadableError' })
      return fakeStream('mic')
    })
    const { result } = renderHook(() => useMediaPreview(prefs, true))
    await waitFor(() => expect(result.current.camera).toBe(false))
    expect(result.current.mic).toBe(true)
    expect(result.current.error).toBe('unavailable')
    expect(result.current.stream).not.toBeNull()
  })

  it('falls back to camera-only when only the mic works', async () => {
    gum.mockImplementation(async (c: Constraints) => {
      if (c.audio) throw Object.assign(new Error('x'), { name: 'NotFoundError' })
      return fakeStream('cam')
    })
    const { result } = renderHook(() => useMediaPreview(prefs, true))
    await waitFor(() => expect(result.current.mic).toBe(false))
    expect(result.current.camera).toBe(true)
    expect(result.current.stream).not.toBeNull()
  })

  it('reports "blocked" and turns both toggles off when permission is denied', async () => {
    gum.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }))
    const { result } = renderHook(() => useMediaPreview(prefs, true))
    await waitFor(() => expect(result.current.error).toBe('blocked'))
    expect(result.current.mic).toBe(false)
    expect(result.current.camera).toBe(false)
    expect(result.current.stream).toBeNull()
  })

  it('a single-device failure has no fallback to try', async () => {
    gum.mockRejectedValue(Object.assign(new Error('x'), { name: 'SecurityError' }))
    const { result } = renderHook(() => useMediaPreview({ micOn: true, camOn: false }, true))
    await waitFor(() => expect(result.current.error).toBe('blocked'))
    expect(gum).toHaveBeenCalledTimes(1)
    expect(result.current.mic).toBe(false)
  })

  it('toggling re-acquires and stops the previous stream', async () => {
    const first = fakeStream('first')
    gum.mockResolvedValueOnce(first)
    const { result } = renderHook(() => useMediaPreview(prefs, true))
    await waitFor(() => expect(result.current.stream).toBe(first))
    act(() => result.current.setCamera(false))
    expect(result.current.camera).toBe(false)
    await waitFor(() => expect(gum).toHaveBeenLastCalledWith({ audio: true, video: false }))
    expect(first.tracks[0].stop).toHaveBeenCalled()
    act(() => result.current.setMic(false))
    await waitFor(() => expect(result.current.stream).toBeNull())
  })

  it('selectDevice updates inputs (re-capture) and output (no capture)', async () => {
    const { result } = renderHook(() => useMediaPreview(prefs, true))
    await waitFor(() => expect(gum).toHaveBeenCalledTimes(1))
    act(() => result.current.selectDevice('audioinput', 'mic1'))
    expect(result.current.audioInput).toBe('mic1')
    await waitFor(() => expect(gum).toHaveBeenLastCalledWith({ audio: { deviceId: 'mic1' }, video: true }))
    act(() => result.current.selectDevice('videoinput', ''))
    expect(result.current.videoInput).toBeUndefined()
    const calls = gum.mock.calls.length
    act(() => result.current.selectDevice('audiooutput', 'spk1'))
    expect(result.current.audioOutput).toBe('spk1')
    act(() => result.current.selectDevice('audiooutput', ''))
    expect(result.current.audioOutput).toBeUndefined()
    await waitFor(() => expect(gum.mock.calls.length).toBe(calls))
  })

  it('toggles while inactive only change state', () => {
    const { result } = renderHook(() => useMediaPreview(prefs, false))
    act(() => result.current.setMic(false))
    expect(result.current.mic).toBe(false)
    expect(gum).not.toHaveBeenCalled()
  })

  it('release stops tracks and clears the stream; a late capture is discarded', async () => {
    let resolve!: (s: MediaStream) => void
    const late = fakeStream('late')
    gum.mockImplementationOnce(() => new Promise<MediaStream>((r) => { resolve = r }))
    const { result } = renderHook(() => useMediaPreview(prefs, true))
    act(() => result.current.release())
    await act(async () => { resolve(late) })
    expect(late.tracks[0].stop).toHaveBeenCalled()
    expect(result.current.stream).toBeNull()
  })

  it('refreshes devices on devicechange, keeps old lists on failure, unsubscribes on unmount', async () => {
    const { result, unmount } = renderHook(() => useMediaPreview(prefs, false))
    await waitFor(() => expect(result.current.devices.audioinput).toHaveLength(1))
    enumerate.mockRejectedValueOnce(new Error('x'))
    await act(async () => { listeners.devicechange() })
    expect(result.current.devices.audioinput).toHaveLength(1)
    enumerate.mockResolvedValueOnce([dev('audioinput', 'a'), dev('audioinput', 'b')])
    await act(async () => { listeners.devicechange() })
    expect(result.current.devices.audioinput.map((d) => d.deviceId)).toEqual(['a', 'b'])
    unmount()
    expect(listeners.devicechange).toBeUndefined()
  })

  it('without mediaDevices it stays empty and never throws', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    const { result } = renderHook(() => useMediaPreview(prefs, true))
    await act(async () => {})
    expect(result.current.stream).toBeNull()
    expect(result.current.devices).toEqual({ audioinput: [], videoinput: [], audiooutput: [] })
    expect(result.current.error).toBeNull()
  })
})
