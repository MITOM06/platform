'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const POPUP_FEATURES = 'width=520,height=720,menubar=no,toolbar=no'

/**
 * Shared OAuth connect-popup flow used by both the static catalog and the
 * dynamic directory. Opens the provider authorize URL in a popup, polls until
 * the backend redirects back to `?connected=` (same-origin) or the popup
 * closes, then fires `onDone`. Falls back to a same-tab redirect when the
 * popup is blocked. Tracks which entry id is mid-connect for button spinners.
 */
export function useOAuthPopup(onDone: () => void) {
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current)
    },
    [],
  )

  const open = useCallback(
    (authorizeUrl: string, id: string) => {
      setConnectingId(id)
      const popup = window.open(authorizeUrl, 'pon-oauth', POPUP_FEATURES)
      if (!popup) {
        // Popup blocked — fall back to same-tab redirect.
        window.location.href = authorizeUrl
        return
      }
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(pollRef.current!)
            setConnectingId(null)
            onDone()
            return
          }
          if (popup.location.search.includes('connected=')) {
            popup.close()
            clearInterval(pollRef.current!)
            setConnectingId(null)
            onDone()
          }
        } catch {
          // Cross-origin while on the provider's domain — ignore until redirect.
        }
      }, 600)
    },
    [onDone],
  )

  const reset = useCallback(() => setConnectingId(null), [])

  return { connectingId, open, reset }
}
