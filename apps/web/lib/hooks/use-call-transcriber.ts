'use client'

import { useEffect, useRef } from 'react'
import { stompService } from '@/lib/stomp/client'

// Minimal typings for the Web Speech API (not in lib.dom for all targets).
interface SpeechRecognitionAlternative {
  transcript: string
}
interface SpeechRecognitionResult {
  isFinal: boolean
  0: SpeechRecognitionAlternative
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Client-side speech-to-text for the AI notetaker (Track A §7).
 *
 * When `enabled` (aiNotetaker on + active call), runs continuous browser
 * `SpeechRecognition` on the local mic. Interim results are ignored; on each
 * FINAL transcript it publishes `/app/call.transcript {callId, text, ts}`.
 * No-ops gracefully when the API is unavailable.
 */
export function useCallTranscriber(callId: string | null, enabled: boolean, lang?: string): void {
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const callIdRef = useRef(callId)

  // Keep the latest callId available to the (long-lived) onresult callback
  // without re-creating the recognizer on every render.
  useEffect(() => {
    callIdRef.current = callId
  }, [callId])

  useEffect(() => {
    if (!enabled || !callId) return
    const Ctor = getRecognitionCtor()
    if (!Ctor) return // unsupported browser → graceful no-op

    let stopped = false
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const result = e.results[i]
        if (!result.isFinal) continue
        const text = result[0]?.transcript?.trim()
        const id = callIdRef.current
        if (text && id) {
          stompService.publish('/app/call.transcript', { callId: id, text, ts: Date.now() })
        }
      }
    }
    // Recognition stops itself periodically; restart while the call is live.
    rec.onend = () => {
      if (!stopped) {
        try {
          rec.start()
        } catch {
          // ignore — already starting / page unloading
        }
      }
    }
    rec.onerror = () => {
      // transient (e.g. no-speech) — onend handles the restart
    }

    recRef.current = rec
    try {
      rec.start()
    } catch {
      // ignore double-start
    }

    return () => {
      stopped = true
      try {
        rec.stop()
      } catch {
        // ignore
      }
      recRef.current = null
    }
  }, [callId, enabled, lang])
}
