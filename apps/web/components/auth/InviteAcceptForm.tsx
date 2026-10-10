'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Smartphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/auth'
import type { InvitationPreview } from '@/lib/api/types'
import { parseAuthError, authCodeToI18nKey } from '@/lib/auth/auth-error'
import { MFA_PATH, isMfaChallenge, savePendingMfa } from '@/lib/auth/mfa'
import { establishSession } from '@/lib/auth/sign-in'
import { maybeRequestNotificationPermission } from '@/lib/notifications'
import { AUTH_URL } from '@/lib/config/env'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { GoogleIcon } from '@/components/auth/GoogleIcon'
import { RevealableInput } from '@/components/auth/RevealableInput'
import { SsoButton, SsoRequiredNotice } from '@/components/auth/SsoSignIn'

type FormData = { displayName: string; password: string; confirmPassword: string; agreeToTerms: boolean }

const MOBILE_UA = /Android|iPhone|iPad|iPod/i
const noopSubscribe = () => () => {}

/** Deep link into the native app (custom scheme; Android uses an intent URL). */
function appInviteHref(token: string, ua: string): string {
  const q = `token=${encodeURIComponent(token)}`
  return /Android/i.test(ua)
    ? `intent://invite?${q}#Intent;scheme=platform;package=com.platform.platform_client;end`
    : `platform://invite?${q}`
}

interface Props {
  token: string
  preview: InvitationPreview
}

/** Invitation title + "X invited you to join Y (as Z)". */
function InviteHeader({ preview }: { preview: InvitationPreview }) {
  const t = useTranslations('auth')
  return (
    <CardHeader>
      <CardTitle className="text-2xl">{t('invite.title')}</CardTitle>
      <CardDescription>
        {preview.roleName
          ? t('invite.subtitle', {
              inviter: preview.inviterName,
              workspace: preview.workspaceName,
              role: preview.roleName,
            })
          : t('invite.subtitleNoRole', {
              inviter: preview.inviterName,
              workspace: preview.workspaceName,
            })}
      </CardDescription>
    </CardHeader>
  )
}

/** Read-only invited email. */
function InvitedEmail({ email }: { email: string }) {
  const t = useTranslations('auth')
  return (
    <div className="space-y-1">
      <Label htmlFor="invite-email">{t('invite.emailLabel')}</Label>
      <Input id="invite-email" value={email} readOnly disabled className="h-11 text-base" />
    </div>
  )
}

/**
 * Accept an invitation either with Google (the Google email must match the
 * invited one — enforced server-side) or by choosing a display name + password.
 * Agreeing to the terms is required for both paths. With a password, a Member
 * invite signs in right away; an Owner/Admin-like invite first sets up 2FA on
 * `/mfa` (contract 15). When the invited email's domain must use single sign-on
 * (`SSO_REQUIRED`), the card switches to "Sign in with SSO", which consumes the
 * pending invitation.
 */
export function InviteAcceptForm({ token, preview }: Props) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [ssoRequired, setSsoRequired] = useState(false)
  // Read the UA without a hydration mismatch (server snapshot = '').
  const ua = useSyncExternalStore(noopSubscribe, () => navigator.userAgent, () => '')
  const isMobile = MOBILE_UA.test(ua)

  const schema = useMemo(
    () =>
      z
        .object({
          displayName: z
            .string()
            .trim()
            .min(2, t('password.displayNameMin')),
          password: z
            .string()
            .min(8, t('password.passwordMin'))
            .regex(/[A-Z]/, t('password.reqUppercase'))
            .regex(/[a-z]/, t('password.reqLowercase'))
            .regex(/[0-9]/, t('password.reqDigit'))
            .regex(/[!@#$%^&*]/, t('password.reqSpecial')),
          confirmPassword: z.string(),
          agreeToTerms: z.boolean().refine((v) => v, { message: t('password.mustAgree') }),
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
    setValue,
    control,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { agreeToTerms: false } })

  const passwordValue = useWatch({ control, name: 'password' }) ?? ''
  const agreed = useWatch({ control, name: 'agreeToTerms' })

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

  const onGoogle = async () => {
    if (!(await trigger('agreeToTerms'))) return
    window.location.href =
      `${AUTH_URL}/auth/social/google/init?platform=web&invite=${encodeURIComponent(token)}`
  }

  const onSubmit = async (data: FormData) => {
    try {
      const result = await authService.acceptInvitation(token, data.displayName.trim(), data.password)
      // Owner/Admin-like invite: 2FA is mandatory, so the session only comes
      // from the first-time setup on /mfa — same as a password sign-in.
      if (isMfaChallenge(result)) {
        savePendingMfa(result)
        router.replace(MFA_PATH)
        return
      }
      // Member invite (2FA optional, contract 15): tokens — a normal sign-in.
      const path = await establishSession(result)
      toast.success(t('invite.welcome', { workspace: preview.workspaceName }))
      void maybeRequestNotificationPermission()
      router.replace(path)
    } catch (err: unknown) {
      const { code, params } = parseAuthError(err)
      if (code === 'SSO_REQUIRED') {
        setSsoRequired(true)
        return
      }
      toast.error(t(authCodeToI18nKey(code), params))
    }
  }

  if (ssoRequired) {
    return (
      <Card className="w-full max-w-md shadow-none border-border">
        <InviteHeader preview={preview} />
        <CardContent className="space-y-4">
          <InvitedEmail email={preview.email} />
          <SsoRequiredNotice message={t('invite.ssoRequired', { workspace: preview.workspaceName })} />
          <SsoButton emphasised />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md shadow-none border-border">
      <InviteHeader preview={preview} />
      <CardContent className="space-y-4">
        <InvitedEmail email={preview.email} />

        <div className="flex flex-row items-start gap-3 py-1">
          <Checkbox
            id="agreeToTerms"
            checked={agreed}
            onCheckedChange={(checked) =>
              setValue('agreeToTerms', checked === true, { shouldValidate: true })
            }
          />
          <div className="space-y-1 leading-none">
            <Label
              htmlFor="agreeToTerms"
              className="font-normal text-sm text-muted-foreground cursor-pointer flex flex-wrap items-center gap-x-1"
            >
              {t.rich('password.agreeToTerms', {
                privacyPolicy: (chunks) => (
                  <Link href="/privacy" target="_blank" className="text-primary hover:underline whitespace-nowrap">
                    {chunks}
                  </Link>
                ),
                termsOfService: (chunks) => (
                  <Link href="/terms" target="_blank" className="text-primary hover:underline whitespace-nowrap">
                    {chunks}
                  </Link>
                ),
              })}
            </Label>
            {errors.agreeToTerms && <p className="text-sm text-destructive">{errors.agreeToTerms.message}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <Button type="button" variant="outline" className="w-full h-11 gap-2" onClick={onGoogle}>
            <GoogleIcon className="h-4 w-4" />
            {t('invite.continueWithGoogle')}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {t('invite.googleHint', { email: preview.email })}
          </p>
        </div>

        {isMobile && (
          <Button asChild variant="outline" className="w-full h-11 gap-2">
            <a href={appInviteHref(token, ua)}>
              <Smartphone className="h-4 w-4" aria-hidden />
              {t('invite.openInApp')}
            </a>
          </Button>
        )}

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">{t('invite.orSetPassword')}</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="displayName">{t('password.displayNameLabel')}</Label>
            <Input
              id="displayName"
              placeholder={t('password.displayNamePlaceholder')}
              autoComplete="name"
              maxLength={50}
              className="h-11 text-base"
              {...register('displayName')}
            />
            {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <RevealableInput
              id="password"
              autoComplete="new-password"
              placeholder={t('password.passwordPlaceholder')}
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            <PasswordStrengthMeter password={passwordValue} labels={strengthLabels} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">{t('password.confirmPasswordLabel')}</Label>
            <RevealableInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder={t('password.confirmPasswordPlaceholder')}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full h-11 text-base font-bold tracking-wide" disabled={isSubmitting}>
            {isSubmitting ? t('invite.submitting') : t('invite.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
