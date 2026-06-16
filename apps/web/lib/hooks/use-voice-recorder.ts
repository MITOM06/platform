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
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      cancelledRef.current = false
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop())
        if (cancelledRef.current) return
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size === 0) return
        onUploadingChange(true)
        try {
          const ext = (recorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm'
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
