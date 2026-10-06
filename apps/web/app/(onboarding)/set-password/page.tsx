'use client'

import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth.store'
import { parseAuthError, authCodeToI18nKey } from '@/lib/auth/auth-error'
import { APP_HOME_PATH } from '@/lib/auth/set-password-gate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { RevealableInput } from '@/components/auth/RevealableInput'

type FormData = { password: string; confirmPassword: string }

/**
 * Mandatory onboarding step for a member who joined with "Continue with
 * Google": create a PON password so email + password sign-in works too.
 * There is deliberately no skip — the `(onboarding)` / `(main)` gates keep the
 * user here until the server clears `mustSetPassword`. Signing out is the only
 * other way out. Later changes live in Settings → Security.
 */
export default function SetPasswordPage() {
  const t = useTranslations('auth')
  const tLayout = useTranslations('layout')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [serverError, setServerError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  // Same policy as accepting an invitation with a password (InviteAcceptForm /
  // mobile accept_invite_password_form): ≥8 chars + upper, lower, digit, special.
  // The server enforces the length (VAL_PASSWORD_TOO_SHORT).
  const schema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(8, t('password.passwordMin'))
            .regex(/[A-Z]/, t('password.reqUppercase'))
            .regex(/[a-z]/, t('password.reqLowercase'))
            .regex(/[0-9]/, t('password.reqDigit'))
            .regex(/[!@#$%^&*]/, t('password.reqSpecial')),
          confirmPassword: z.string(),
        })
        .refine((d) => d.password === d.confirmPassword, {
          message: t('password.confirmPasswordMismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  )

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const passwordValue = useWatch({ control, name: 'password' }) ?? ''

  const strengthLabels = {
    weak: t('password.pwStrengthWeak'),
    medium: t('password.pwStrengthMedium'),
    strong: t('password.pwStrengthStrong'),
    veryStrong: t('password.pwStrengthVeryStrong'),
    reqLength: t('password.reqLength'),
    reqUppercase: t('password.reqUppercase'),
    reqLowercase: t('password.reqLowercase'),
    reqDigit: t('password.reqDigit'),
    reqSpecial: t('password.reqSpecial'),
  }

  const onSubmit = async ({ password }: FormData) => {
    setServerError(null)
    try {
      // The account has no password yet, so no current password is sent.
      await authService.changePassword(undefined, password)
    } catch (err: unknown) {
      // Typed code → localized text; never the raw server body.
      const { code, params } = parseAuthError(err)
      setServerError(t(authCodeToI18nKey(code), params))
      return
    }
    // The server cleared the flag. Refresh the profile, and clear the flag
    // locally even if /me is momentarily unreachable — otherwise the gate
    // would bounce the user straight back here.
    const fresh = await authService.getMe().catch(() => null)
    toast.success(t('setPassword.success'))
    updateUser({ ...(fresh ?? {}), hasPassword: true, mustSetPassword: false })
    router.replace(APP_HOME_PATH)
  }

  const onSignOut = async () => {
    setSigningOut(true)
    try {
      await fetch('/api/auth/clear-cookie', { method: 'POST' })
      clearAuth()
      // `?cleared=1` makes the login page wipe autofilled credentials.
      router.push('/login?cleared=1')
    } catch {
      toast.error(tLayout('logoutError'))
      setSigningOut(false)
    }
  }

  // SessionInitializer renders this page only once the session resolved; a
  // missing user means a sign-out / logout redirect is already under way.
  if (!user) {
    return (
      <div className="flex justify-center py-16" role="status">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      </div>
    )
  }

  const busy = isSubmitting || signingOut

  return (
    <Card className="w-full max-w-md shadow-none border-border">
      <CardHeader>
        <CardTitle className="text-2xl">{t('setPassword.title')}</CardTitle>
        <CardDescription>{t('setPassword.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <div
              role="alert"
              className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          {/* Read-only account email: tells the user which address to sign in
              with, and lets password managers file the new password under it. */}
          <div className="space-y-1">
            <Label htmlFor="set-password-email">{t('emailLabel')}</Label>
            <Input
              id="set-password-email"
              value={user.email}
              readOnly
              autoComplete="username"
              className="h-11 text-base text-muted-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="set-password-new">{t('setPassword.newPasswordLabel')}</Label>
            <RevealableInput
              id="set-password-new"
              autoComplete="new-password"
              placeholder={t('password.passwordPlaceholder')}
              aria-invalid={errors.password ? true : undefined}
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            <PasswordStrengthMeter password={passwordValue} labels={strengthLabels} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="set-password-confirm">{t('password.confirmPasswordLabel')}</Label>
            <RevealableInput
              id="set-password-confirm"
              autoComplete="new-password"
              placeholder={t('password.confirmPasswordPlaceholder')}
              aria-invalid={errors.confirmPassword ? true : undefined}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full h-11 text-base font-bold tracking-wide" disabled={busy}>
            {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" aria-hidden />}
            {isSubmitting ? t('setPassword.submitting') : t('setPassword.submit')}
          </Button>
        </form>

        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="link"
            className="gap-1.5 text-muted-foreground"
            onClick={onSignOut}
            disabled={busy}
          >
            <LogOut className="size-4" aria-hidden />
            {tLayout('menuLogout')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
