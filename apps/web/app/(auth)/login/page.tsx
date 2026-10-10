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
import { parseAuthError, authCodeToI18nKey } from '@/lib/auth/auth-error'
import { isLoginNotice } from '@/lib/auth/force-logout'
import { MFA_PATH, isMfaChallenge, savePendingMfa } from '@/lib/auth/mfa'
import { establishSession } from '@/lib/auth/sign-in'
import { maybeRequestNotificationPermission } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AUTH_URL } from '@/lib/config/env'
import { GoogleIcon } from '@/components/auth/GoogleIcon'
import { SsoButton, SsoRequiredNotice } from '@/components/auth/SsoSignIn'

type FormData = { email: string; password: string }

export default function LoginPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  // AUTH_URL always resolves — an absolute host when one is configured, the
  // same-origin '/api/auth' otherwise — so the social/SSO links work in every
  // deployment shape. They used to be hidden whenever the env var was unset,
  // which silently removed social login from the self-host build.
  const authBase = AUTH_URL
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
  // Forced logout (e.g. the account was blocked) and failed Google / SSO
  // sign-ins land here with `?reason=CODE`. Only allow-listed codes are shown,
  // always localized.
  const rawReason = searchParams?.get('reason')
  const logoutReason = isLoginNotice(rawReason) ? rawReason : null
  // A password sign-in just answered SSO_REQUIRED (the email's domain must use
  // single sign-on): same notice as `?reason=SSO_REQUIRED`, no toast.
  const [ssoRequired, setSsoRequired] = useState(false)
  const notice = ssoRequired ? 'SSO_REQUIRED' : logoutReason
  const ssoNotice = notice === 'SSO_REQUIRED'
  // The SSO button shows when SSO is on — or the server says it's required —
  // and becomes the primary way in when the workspace requires SSO.
  const showSso = ssoNotice || sso?.enabled === true
  const emphasiseSso = showSso && (ssoNotice || sso?.enforced === true)
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
      // The password was right but no session exists yet — the authenticator
      // code (or first-time 2FA setup) is finished on /mfa.
      if (isMfaChallenge(result)) {
        savePendingMfa(result)
        router.push(MFA_PATH)
        return
      }

      const path = await establishSession(result)
      // Prompt for notification permission only after a successful login.
      void maybeRequestNotificationPermission()
      router.push(path)
    } catch (err: unknown) {
      const { code, params } = parseAuthError(err)
      if (code === 'SSO_REQUIRED') {
        setSsoRequired(true)
        setValue('password', '')
        return
      }
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
        {ssoNotice ? (
          <SsoRequiredNotice message={t('errSsoRequired')} className="mb-4" />
        ) : (
          notice && (
            <div
              role="alert"
              data-testid="logout-reason"
              className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {t(authCodeToI18nKey(notice))}
            </div>
          )
        )}
        {emphasiseSso && (
          <>
            <SsoButton emphasised />
            <div className="flex items-center gap-3 my-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{t('login.orSignInWithPassword')}</span>
              <Separator className="flex-1" />
            </div>
          </>
        )}
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

          <Button
            type="submit"
            variant={emphasiseSso ? 'outline' : 'default'}
            className="w-full h-11 text-base font-bold tracking-wide"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>

        {showSso && !emphasiseSso && <SsoButton className="mt-3" />}

        <>
            <div className="flex items-center gap-3 my-4">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{t('login.orContinueWith')}</span>
              <Separator className="flex-1" />
            </div>
            <div className="flex flex-col gap-2">
              <a
                href={`${authBase}/auth/social/google/init?platform=web`}
                className="flex items-center justify-center gap-2 w-full rounded-[10px] border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <GoogleIcon className="h-4 w-4" />
                {t('login.googleLogin')}
              </a>

            </div>
        </>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('login.inviteOnlyHint')}
        </p>
      </CardContent>
    </Card>
  )
}
