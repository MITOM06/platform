'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth.store'
import { isGuestOnlyPath } from '@/lib/auth/guest-paths'

const signedInOn = (pathname: string) =>
  isGuestOnlyPath(pathname) && useAuthStore.getState().user !== null

/**
 * Keeps a signed-in user off the sign-in pages on client-side navigations.
 *
 * `middleware.ts` bounces a signed-in browser off them on every server request,
 * but Back / Forward never reach it: after signing in, Back showed the login
 * form again until a reload. Opening one of these pages while a session is in
 * memory leaves for the app at once, rendering nothing meanwhile.
 *
 * Checked when the page changes, never when the session does: a sign-in that
 * completes on one of these pages (login, /mfa, /oauth-callback, an invitation)
 * navigates on by itself and must not be overridden.
 */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [leaving, setLeaving] = useState(() => signedInOn(pathname))
  const [checkedPath, setCheckedPath] = useState(pathname)

  // A page change inside this group (state kept across Back / Forward):
  // re-check during render, the React way to adjust state to a new prop.
  if (pathname !== checkedPath) {
    setCheckedPath(pathname)
    if (signedInOn(pathname)) setLeaving(true)
  }

  useEffect(() => {
    if (leaving) router.replace('/')
  }, [leaving, router])

  return leaving ? null : <>{children}</>
}
