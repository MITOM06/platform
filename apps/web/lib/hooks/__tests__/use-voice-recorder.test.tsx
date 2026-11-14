import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ReportedSendError } from '@/lib/chat/send-error'

const h = vi.hoisted(() => ({
  toast: { error: vi.fn() },
  upload: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/chat', () => ({ chatService: { uploadFile: h.upload } }))

import { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder'

class FakeRecorder {
  static supported = new Set(['audio/webm'])
  static isTypeSupported = (m: string) => FakeRecorder.supported.has(m)
  static last: FakeRecorder | null = null
  mimeType: string
  ondataavailable: ((ev: { data: Blob }) => void) | null = null
  onstop: (() => Promise<void>) | null = null
  start = vi.fn()
  stop = vi.fn(() => { void this.onstop?.() })
  constructor(public stream: MediaStream, opts?: { mimeType?: string }) {
    this.mimeType = opts?.mimeType ?? ''
    FakeRecorder.last = this
  }
}

const track = { stop: vi.fn() }
const labels = { unsupported: 'UNSUPPORTED', sendError: 'SEND_ERR', micError: 'MIC_ERR' }
const origMedia = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
let gum: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  h.toast.error.mockReset(); h.upload.mockReset().mockResolvedValue({ url: 'https://cdn/v.webm' })
  track.stop.mockReset()
  FakeRecorder.supported = new Set(['audio/webm'])
  FakeRecorder.last = null
  gum = vi.fn().mockResolvedValue({ getTracks: () => [track] })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: gum } })
  vi.stubGlobal('MediaRecorder', FakeRecorder)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  if (origMedia) Object.defineProperty(navigator, 'mediaDevices', origMedia)
  else delete (navigator as unknown as Record<string, unknown>).mediaDevices
})

function setup(onSend = vi.fn()) {
  const onUploadingChange = vi.fn()
  const r = renderHook(() => useVoiceRecorder({ onSend, onUploadingChange, labels }))
  return { ...r, onSend, onUploadingChange }
}

const feed = (bytes: string) => FakeRecorder.last!.ondataavailable!({ data: new Blob([bytes]) })

describe('useVoiceRecorder', () => {
  it('toasts unsupported when getUserMedia is missing', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    const { result } = setup()
    await act(async () => { await result.current.startRecording() })
    expect(h.toast.error).toHaveBeenCalledWith('UNSUPPORTED')
    expect(result.current.recording).toBe(false)
  })

  it('toasts the mic error when permission is refused', async () => {
    gum.mockRejectedValue(new Error('NotAllowed'))
    const { result } = setup()
    await act(async () => { await result.current.startRecording() })
    expect(h.toast.error).toHaveBeenCalledWith('MIC_ERR')
    expect(result.current.recording).toBe(false)
  })

  it('records with a supported mime type and counts seconds', async () => {
    const { result } = setup()
    await act(async () => { await result.current.startRecording() })
    expect(gum).toHaveBeenCalledWith({ audio: true })
    expect(FakeRecorder.last!.mimeType).toBe('audio/webm')
    expect(FakeRecorder.last!.start).toHaveBeenCalled()
    expect(result.current.recording).toBe(true)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.recordSeconds).toBe(3)
  })

  it('stopAndSend uploads the blob as .webm and calls onSend', async () => {
    vi.setSystemTime(1000)
    const { result, onSend, onUploadingChange } = setup()
    await act(async () => { await result.current.startRecording() })
    feed('abc')
    FakeRecorder.last!.ondataavailable!({ data: new Blob([]) })
    await act(async () => { result.current.stopAndSend() })
    expect(result.current.recording).toBe(false)
    expect(track.stop).toHaveBeenCalled()
    const [blob, name] = h.upload.mock.calls[0]
    expect((blob as Blob).size).toBe(3)
    expect((blob as Blob).type).toBe('audio/webm')
    expect(name).toBe('voice_1000.webm')
    expect(onSend).toHaveBeenCalledWith('https://cdn/v.webm', 'voice')
    expect(onUploadingChange.mock.calls).toEqual([[true], [false]])
    act(() => { vi.advanceTimersByTime(5000) })
    expect(result.current.recordSeconds).toBe(0)
  })

  it('uses .ogg when only ogg is supported', async () => {
    FakeRecorder.supported = new Set(['audio/ogg'])
    const { result } = setup()
    await act(async () => { await result.current.startRecording() })
    feed('x')
    await act(async () => { result.current.stopAndSend() })
    expect(h.upload.mock.calls[0][1]).toMatch(/\.ogg$/)
  })

  it('without a supported type uses the default constructor and falls back to webm', async () => {
    FakeRecorder.supported = new Set()
    const { result } = setup()
    await act(async () => { await result.current.startRecording() })
    expect(FakeRecorder.last!.mimeType).toBe('')
    feed('x')
    await act(async () => { result.current.stopAndSend() })
    expect((h.upload.mock.calls[0][0] as Blob).type).toBe('audio/webm')
  })

  it('an empty recording is not uploaded', async () => {
    const { result, onUploadingChange } = setup()
    await act(async () => { await result.current.startRecording() })
    await act(async () => { result.current.stopAndSend() })
    expect(h.upload).not.toHaveBeenCalled()
    expect(onUploadingChange).not.toHaveBeenCalled()
  })

  it('cancelRecording discards the audio', async () => {
    const { result, onSend } = setup()
    await act(async () => { await result.current.startRecording() })
    feed('abc')
    await act(async () => { result.current.cancelRecording() })
    expect(result.current.recording).toBe(false)
    expect(track.stop).toHaveBeenCalled()
    expect(h.upload).not.toHaveBeenCalled()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('upload failure toasts the send error and clears uploading', async () => {
    h.upload.mockRejectedValue(new Error('500'))
    const { result, onUploadingChange } = setup()
    await act(async () => { await result.current.startRecording() })
    feed('abc')
    await act(async () => { result.current.stopAndSend() })
    expect(h.toast.error).toHaveBeenCalledWith('SEND_ERR')
    expect(onUploadingChange).toHaveBeenLastCalledWith(false)
  })

  it('an already-reported send error is not toasted twice', async () => {
    const { result } = setup(vi.fn().mockRejectedValue(new ReportedSendError()))
    await act(async () => { await result.current.startRecording() })
    feed('abc')
    await act(async () => { result.current.stopAndSend() })
    expect(h.toast.error).not.toHaveBeenCalled()
  })

  it('stop / cancel before starting are safe no-ops', () => {
    const { result } = setup()
    act(() => { result.current.stopAndSend(); result.current.cancelRecording() })
    expect(result.current.recording).toBe(false)
  })
})
