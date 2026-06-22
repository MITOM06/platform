'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { chatService } from '@/lib/api/chat'

interface Options {
  onSend: (url: string, type: 'voice') => Promise<void> | void
  onUploadingChange: (uploading: boolean) => void
  labels: { unsupported: string; sendError: string; micError: string }
}

/**
 * MediaRecorder-based voice note recording. Mirrors the Flutter chat input
 * voice flow: hold to record, send on stop, discard on cancel.
 */
export function useVoiceRecorder({ onSend, onUploadingChange, labels }: Options) {
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)

  const stopTimer = useCallback(() => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    recordTimerRef.current = null
  }, [])

  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error(labels.unsupported)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Pick a mimeType chat-service accepts (audio/webm or audio/ogg). Letting
      // MediaRecorder default can yield audio/mp4 (Safari), which the server's
      // content-type validation rejects → silent voice-message upload failures.
      const preferred = ['audio/webm', 'audio/ogg']
      const supported = preferred.find(
        (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
      )
      const recorder = supported
        ? new MediaRecorder(stream, { mimeType: supported })
        : new MediaRecorder(stream)
      chunksRef.current = []
      cancelledRef.current = false
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop())
        if (cancelledRef.current) return
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size === 0) return
        onUploadingChange(true)
        try {
          // Match the extension to the recorded mimeType so the upload's
          // content-type (derived from blob.type / extension) passes the
          // server's audio validation.
          const ext = mimeType.includes('ogg') ? 'ogg' : 'webm'
          const { url } = await chatService.uploadFile(blob, `voice_${Date.now()}.${ext}`)
          await onSend(url, 'voice')
        } catch {
          toast.error(labels.sendError)
        } finally {
          onUploadingChange(false)
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } catch {
      toast.error(labels.micError)
    }
  }

  const stopAndSend = () => {
    stopTimer()
    setRecording(false)
    recorderRef.current?.stop()
  }

  const cancelRecording = () => {
    cancelledRef.current = true
    stopTimer()
    setRecording(false)
    recorderRef.current?.stop()
  }

  return { recording, recordSeconds, startRecording, stopAndSend, cancelRecording }
}
