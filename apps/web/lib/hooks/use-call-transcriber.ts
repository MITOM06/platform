'use client'

import { useCallback, useEffect, useRef } from 'react'
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

export function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Core browser speech-to-text: while `enabled`, runs continuous
 * `SpeechRecognition` on the local mic and calls `onFinal` with each FINAL
 * transcript (interim results are ignored). `supported` is false when the
 * browser has no SpeechRecognition (the hook then no-ops).
 */
export function useSpeechTranscriber(
  enabled: boolean,
  onFinal: (text: string) => void,
  lang?: string,
): { supported: boolean } {
  const onFinalRef = useRef(onFinal)
  // Keep the latest callback available to the (long-lived) onresult handler
  // without re-creating the recognizer on every render.
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  useEffect(() => {
    if (!enabled) return
    const Ctor = getRecognitionCtor()
    if (!Ctor) return // unsupported browser → graceful no-op

    let stopped = false
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')

    rec.onresult = (e) => {
      if (stopped) return // a stopped recognizer can still flush a late result
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const result = e.results[i]
        if (!result.isFinal) continue
        const text = result[0]?.transcript?.trim()
        if (text) onFinalRef.current(text)
      }
    }
    // Recognition stops itself periodically; restart while enabled.
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
    }
  }, [enabled, lang])

  return { supported: getRecognitionCtor() !== null }
}

/**
 * Client-side speech-to-text for the AI notetaker (Track A §7).
 *
 * When `enabled` (aiNotetaker on + active call), publishes
 * `/app/call.transcript {callId, text, ts}` on each FINAL transcript.
 */
export function useCallTranscriber(callId: string | null, enabled: boolean, lang?: string): void {
  const onFinal = useCallback(
    (text: string) => {
      if (callId) stompService.publish('/app/call.transcript', { callId, text, ts: Date.now() })
    },
    [callId],
  )
  useSpeechTranscriber(enabled && !!callId, onFinal, lang)
}
