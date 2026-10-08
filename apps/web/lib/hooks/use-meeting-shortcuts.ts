'use client'

import { useEffect, useRef } from 'react'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'
import { isMacPlatform, matchShortcut } from '@/lib/meetings/shortcuts'

/**
 * Meeting keyboard shortcuts on `window`: ⌘/Ctrl+D mic, ⌘/Ctrl+E camera,
 * ⌘/Ctrl+Alt+H hand. IME composition and key repeat never fire them (matchShortcut).
 */
export function useMeetingShortcuts(controller: MeetingRoomController, handRaised: boolean): void {
  // Latest hand state for the listener without re-binding it on every change.
  const raisedRef = useRef(handRaised)
  useEffect(() => {
    raisedRef.current = handRaised
  }, [handRaised])

  useEffect(() => {
    const mac = isMacPlatform()
    const onKey = (e: KeyboardEvent) => {
      const action = matchShortcut(e, mac)
      if (!action) return
      e.preventDefault()
      if (action === 'toggleMic') void controller.toggleMic()
      else if (action === 'toggleCamera') void controller.toggleCamera()
      else controller.setHand(!raisedRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controller])
}
