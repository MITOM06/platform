'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import axios from 'axios'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth.store'
import type { AuthUser } from '@/lib/store/auth.store'

const PUBLIC_PATHS = ['/login', '/register', '/verify-otp']

export function SessionInitializer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const [loading, setLoading] = useState(!isPublicPath)

  useEffect(() => {
    if (isPublicPath) {
      return
    }

    const initSession = async () => {
      try {
        const { data } = await axios.get<{ user: AuthUser; accessToken: string }>('/api/auth/session')
        setAuth(data.user, data.accessToken)
      } catch {
        clearAuth()
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    initSession()
  }, [isPublicPath, setAuth, clearAuth, router])

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Đang kết nối phiên làm việc...
        </p>
      </div>
    )
  }

  return <>{children}</>
}
