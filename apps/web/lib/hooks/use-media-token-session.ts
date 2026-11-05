'use client'
// Session-level media-token wiring for the protected shell — mirror of the Flutter
// `didChangeAppLifecycleState(resumed)` re-ensure + `MediaTokenRemount` widget.
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store/auth.store'
import { useMediaTokenStore, watchMediaTokenResume } from '@/lib/media-token'

/** Re-ensure the media token when the tab is visible / focused again, while signed in. */
export function useMediaTokenResume(): void {
  const signedIn = useAuthStore((s) => !!s.accessToken)
  useEffect(() => (signedIn ? watchMediaTokenResume() : undefined), [signedIn])
}

/**
 * React `key` for the shell content: changes when the media token arrives late (none → value),
 * so media rendered without `t` remounts with it. Refreshes keep the same key. While `paused`
 * (e.g. inside a live meeting room) the key is frozen so nothing remounts mid-call.
 */
export function useMediaRemountKey(paused = false): number {
  const epoch = useMediaTokenStore((s) => s.epoch)
  const [key, setKey] = useState(epoch)
  // Derived state, adjusted during render (React's documented pattern), not in an effect.
  if (!paused && key !== epoch) setKey(epoch)
  return paused ? key : epoch
}
