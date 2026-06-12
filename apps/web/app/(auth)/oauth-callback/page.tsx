'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authService } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth.store'

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      router.replace('/login')
      return
    }

    authService
      .exchangeCode(code)
      .then(async ({ data }) => {
        const { accessToken, refreshToken, sid, user } = data
        await fetch('/api/auth/set-cookie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, refreshToken, sid }),
        })
        setAuth(user, accessToken)
        router.replace('/')
      })
      .catch(() => {
        toast.error('Xác thực thất bại, vui lòng thử lại.')
        router.replace('/login')
      })
  }, [searchParams, router, setAuth])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Đang xác thực...</p>
      </div>
    </div>
  )
}
