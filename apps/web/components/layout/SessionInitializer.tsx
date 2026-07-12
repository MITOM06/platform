'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import axios from 'axios'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@/lib/store/auth.store'
import type { AuthUser } from '@/lib/store/auth.store'
import { isAuthFailure } from '@/lib/api/axios'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/verify-otp',
  '/oauth-callback',
  '/forgot-password',
  '/privacy',
  '/terms',
]

export function SessionInitializer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('layout')
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const [loading, setLoading] = useState(!isPublicPath)

  useEffect(() => {
    if (isPublicPath) {
      return
    }

    let cancelled = false
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const initSession = async () => {
      // Retry loop: a transient failure (auth-service cold start, network blip,
      // 503 from the session route) must NEVER bounce the user to /login —
      // that was the "kicked out after reopening the app" bug. Only a genuine
      // 401/403 (session dead / cookies gone) logs out. The one benign 401 is
      // REFRESH_TOKEN_ROTATED (a sibling tab rotated first): retrying sends the
      // sibling's rotated cookie and succeeds, so give auth failures one retry
      // before giving up.
      let authFailures = 0
      for (let attempt = 0; !cancelled; attempt++) {
        try {
          const { data } = await axios.get<{ user: AuthUser; accessToken: string }>('/api/auth/session')
          if (!cancelled) setAuth(data.user, data.accessToken)
          break
        } catch (err) {
          if (isAuthFailure(err)) {
            authFailures++
            if (authFailures >= 2) {
              if (!cancelled) {
                clearAuth()
                router.push('/login')
              }
              break
            }
            await sleep(400)
            continue
          }
          // Transient — keep the spinner and retry with capped backoff.
          await sleep(Math.min(2000 * 2 ** attempt, 15000))
        }
      }
      if (!cancelled) setLoading(false)
    }

    initSession()
    return () => {
      cancelled = true
    }
  }, [isPublicPath, setAuth, clearAuth, router])

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          {t('sessionConnecting')}
        </p>
      </div>
    )
  }

  return <>{children}</>
}
