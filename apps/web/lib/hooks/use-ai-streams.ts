'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LOCAL_STREAM_KEY,
  applyAiStreamEvent,
  dropLocalStream,
  finishReplyStream,
  startLocalStream,
  type AiStreamEntry,
  type AiStreamEvent,
} from '@/lib/ai/stream-routing'

/** A bubble with no event for this long is dropped (parity with Flutter's 30s watchdog). */
export const AI_STREAM_WATCHDOG_MS = 30_000

export interface UseAiStreamsResult {
  streams: AiStreamEntry[]
  /** Route one AI frame; returns true when this client should toast its error. */
  handleEvent: (event: AiStreamEvent) => boolean
  /** "Thinking" placeholder for a message I just sent that triggers the AI. */
  startLocal: () => void
  /** The send failed — no reply is coming. */
  dropLocal: () => void
  /** The saved AI message of this reply arrived — swap its bubble for the message. */
  finishReply: (replyId: string) => void
}

/**
 * Per-reply AI streaming bubbles for one conversation (routing in
 * `lib/ai/stream-routing.ts`). Each bubble has its own watchdog so a reply that
 * never finishes cannot leave a spinner forever, and one reply ending never
 * touches another one.
 */
export function useAiStreams(conversationId: string, me?: string): UseAiStreamsResult {
  const [streams, setStreams] = useState<AiStreamEntry[]>([])
  // Mirror for synchronous reads in handleEvent (STOMP frames arrive outside React).
  const streamsRef = useRef<AiStreamEntry[]>([])
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const commit = useCallback((next: AiStreamEntry[]) => {
    streamsRef.current = next
    setStreams(next)
  }, [])

  const clearTimer = useCallback((key: string) => {
    const timer = timersRef.current.get(key)
    if (timer) clearTimeout(timer)
    timersRef.current.delete(key)
  }, [])

  const arm = useCallback(
    (key: string) => {
      clearTimer(key)
      timersRef.current.set(
        key,
        setTimeout(() => {
          timersRef.current.delete(key)
          commit(streamsRef.current.filter((s) => s.key !== key))
        }, AI_STREAM_WATCHDOG_MS),
      )
    },
    [clearTimer, commit],
  )

  const handleEvent = useCallback(
    (event: AiStreamEvent): boolean => {
      const result = applyAiStreamEvent(streamsRef.current, event, me)
      result.removedKeys.forEach(clearTimer)
      if (result.touchedKey) arm(result.touchedKey)
      if (result.streams !== streamsRef.current) commit(result.streams)
      return result.notifyError
    },
    [arm, clearTimer, commit, me],
  )

  const startLocal = useCallback(() => {
    commit(startLocalStream(streamsRef.current, me))
    arm(LOCAL_STREAM_KEY)
  }, [arm, commit, me])

  const dropLocal = useCallback(() => {
    clearTimer(LOCAL_STREAM_KEY)
    commit(dropLocalStream(streamsRef.current))
  }, [clearTimer, commit])

  const finishReply = useCallback(
    (replyId: string) => {
      const result = finishReplyStream(streamsRef.current, replyId)
      if (result.removedKeys.length === 0) return
      result.removedKeys.forEach(clearTimer)
      commit(result.streams)
    },
    [clearTimer, commit],
  )

  // A new conversation starts with no live bubbles; timers never outlive the screen.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
      streamsRef.current = []
      setStreams([])
    }
  }, [conversationId])

  return { streams, handleEvent, startLocal, dropLocal, finishReply }
}
