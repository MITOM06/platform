'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth.store'
import { parseAuthError, authCodeToI18nKey } from '@/lib/auth/auth-error'
import { maybeRequestNotificationPermission } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type FormData = { email: string; password: string }

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? ''
  // Same-origin fallback so SSO works in the self-host (relative-URL) build too.
  const authBase = process.env.NEXT_PUBLIC_AUTH_URL || '/api/auth'
  const { data: sso } = useQuery({
    queryKey: ['sso-info'],
    queryFn: () => authService.getSsoInfo(),
    staleTime: 5 * 60 * 1000,
  })

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('emailInvalid')),
        password: z.string().min(1, t('login.passwordRequired')),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // After a logout we redirect here with `?cleared=1`. Browsers re-autofill the
  // form *after* React renders, so we wipe the fields on a short delay to win
  // that race. A normal visit to /login (no `?cleared=1`) keeps legitimate
  // autofill working.
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams?.get('cleared') !== '1') return
    const timer = setTimeout(() => {
      setValue('email', '')
      setValue('password', '')
    }, 150)
    return () => clearTimeout(timer)
  }, [searchParams, setValue])

  // Pre-fill from a just-completed password reset (see forgot-password page).
  // Consume-once: read, immediately clear, and ignore anything older than 5 min.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pon:auth:prefill')
      if (!raw) return
      sessionStorage.removeItem('pon:auth:prefill')

      const { email, _ts } = JSON.parse(raw) as {
        email: string
        _ts: number
      }
      if (Date.now() - _ts > 5 * 60 * 1000) return

      // Only the email is pre-filled — the password is never persisted (XSS risk).
      // The user re-enters the password they just set.
      setValue('email', email, { shouldDirty: false })
    } catch {
      // Malformed JSON or storage blocked — nothing to prefill.
    }
  }, [setValue])

  const onSubmit = async (data: FormData) => {
    try {
      const { data: result } = await authService.login(data.email, data.password)
      const { accessToken, refreshToken, sid, user } = result

      await fetch('/api/auth/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, refreshToken, sid }),
      })

      setAuth(user, accessToken)
      // Prompt for notification permission only after a successful login.
      void maybeRequestNotificationPermission()
      router.push('/')
    } catch (err: unknown) {
      const { code, params } = parseAuthError(err)
      toast.error(t(authCodeToI18nKey(code), params))
      // Unverified account: backend resent a fresh OTP → steer to verification
      // instead of leaving the user stuck on a login error they can't resolve.
      if (code === 'ACCOUNT_UNVERIFIED_OTP_SENT') {
        router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`)
      }
    }
  }

  return (
    <Card className="w-full max-w-md shadow-none border-border">
      <CardHeader>
        <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
        <CardDescription>{t('login.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 motion-safe:pon-stagger">
          <div className="space-y-1">
            <Label htmlFor="email">{t('emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              autoComplete="email"
              className="h-11 text-base"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="h-11 text-base pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              {t('login.forgotPassword')}
            </Link>
          </div>

          <Button type="submit" className="w-full h-11 text-base font-bold tracking-wide" disabled={isSubmitting}>
            {isSubmitting ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>

        {sso?.enabled && (
          <a
            href={`${authBase}/auth/oidc/login?platform=web`}
            className="mt-3 flex items-center justify-center gap-2 w-full rounded-md border border-primary/40 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            {t('login.ssoButton')}
          </a>
        )}

        {authUrl && (
          <>
            <div className="flex items-center gap-3 my-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{t('login.orContinueWith')}</span>
              <Separator className="flex-1" />
            </div>
            <div className="flex flex-col gap-2">
              <a
                href={`${authUrl}/auth/social/google/init?platform=web`}
                className="flex items-center justify-center gap-2 w-full rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t('login.googleLogin')}
              </a>

            </div>
          </>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('login.noAccount')}{' '}
          <Link href="/register" className="underline underline-offset-4 hover:text-primary">
            {t('login.registerLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
