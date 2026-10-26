'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store/auth.store'

/**
 * Keeps a signed-out page from showing the previous user's data again on Back.
 *
 * The browser keeps a page it leaves in its back/forward cache (bfcache) and
 * shows that frozen copy on Back — no request, so `middleware.ts` never runs and
 * the conversation list was readable after "Sign out" until a reload.
 *
 * - Once the auth store is signed out (logout, forced logout), an opaque curtain
 *   covers the app, so the copy frozen by the hard navigation to /login that
 *   follows shows nothing.
 * - A page restored from the bfcache while signed out leaves for /login at once
 *   (the middleware sends a still-signed-in browser on to the app).
 *
 * Mounted by the authenticated layouts (`(main)`, `(onboarding)`), where the
 * session is always resolved before anything renders (SessionInitializer).
 */
export function SignedOutCurtain() {
  const signedOut = useAuthStore((s) => s.user === null)

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted && useAuthStore.getState().user === null) window.location.replace('/login')
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  if (!signedOut) return null
  return (
    <div
      aria-hidden
      data-testid="signed-out-curtain"
      className="fixed inset-0 z-[9999] bg-background"
    />
  )
}
