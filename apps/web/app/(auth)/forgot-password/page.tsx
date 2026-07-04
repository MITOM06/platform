'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/auth'
import { parseAuthError, authCodeToI18nKey } from '@/lib/auth/auth-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OtpInput } from '@/components/auth/OtpInput'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

type Step = 'request' | 'otp' | 'reset'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword')
  const tAuth = useTranslations('auth')
  const router = useRouter()

  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  // Collected on the OTP step; submitted together with the new password.
  const [collectedOtp, setCollectedOtp] = useState('')

  // ── Step: request ──────────────────────────────────────────────
  const requestSchema = useMemo(
    () => z.object({ email: z.string().email(tAuth('emailInvalid')) }),
    [tAuth],
  )
  const {
    register: regEmail,
    handleSubmit: submitEmail,
    formState: { errors: emailErrors, isSubmitting: emailSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(requestSchema) })

  const onRequestOtp = async ({ email: e }: { email: string }) => {
    try {
      await authService.forgotPassword(e)
      setEmail(e)
      setStep('otp')
      // Start the 60s cooldown immediately so the user can't spam "Resend"
      // the moment they land on the OTP step.
      startResendTimer()
      toast.success(t('codeSent'))
    } catch (err: unknown) {
      const { code, params } = parseAuthError(err)
      toast.error(tAuth(authCodeToI18nKey(code), params))
    }
  }

  // ── Step: OTP ─────────────────────────────────────────────────
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [resendTimer, setResendTimer] = useState(0)
  const [otpError, setOtpError] = useState('')

  const startResendTimer = () => {
    setResendTimer(RESEND_COOLDOWN)
    const id = setInterval(() => {
      setResendTimer((s) => {
        if (s <= 1) { clearInterval(id); return 0 }
        return s - 1
      })
    }, 1000)
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    try {
      await authService.forgotPassword(email)
      toast.success(t('codeSent'))
      startResendTimer()
    } catch (err: unknown) {
      // Surface the specific backend code (e.g. per-email OTP rate limit)
      // instead of a generic resend error.
      const { code, params } = parseAuthError(err)
      toast.error(code === 'GENERIC_ERROR' ? t('resendError') : tAuth(authCodeToI18nKey(code), params))
    }
  }

  const onOtpNext = () => {
    const code = otp.join('')
    if (code.length < OTP_LENGTH) {
      setOtpError(t('otpMinLength'))
      return
    }
    setOtpError('')
    setCollectedOtp(code)
    setStep('reset')
  }

  // ── Step: reset password ───────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const resetSchema = useMemo(
    () =>
      z
        .object({
          password: z
            .string()
            .min(8, t('newPasswordMin'))
            .regex(/[A-Z]/, tAuth('register.reqUppercase'))
            .regex(/[a-z]/, tAuth('register.reqLowercase'))
            .regex(/[0-9]/, tAuth('register.reqDigit'))
            .regex(/[!@#$%^&*]/, tAuth('register.reqSpecial')),
          confirm: z.string(),
        })
        .refine((d) => d.password === d.confirm, {
          message: t('passwordMismatch'),
          path: ['confirm'],
        }),
    [t, tAuth],
  )

  const {
    register: regReset,
    handleSubmit: submitReset,
    watch: watchReset,
    formState: { errors: resetErrors, isSubmitting: resetSubmitting },
  } = useForm<{ password: string; confirm: string }>({ resolver: zodResolver(resetSchema) })

  const passwordValue = watchReset('password') ?? ''

  const strengthLabels = {
    weak: tAuth('register.pwStrengthWeak'),
    medium: tAuth('register.pwStrengthMedium'),
    strong: tAuth('register.pwStrengthStrong'),
    veryStrong: tAuth('register.pwStrengthVeryStrong'),
    reqLength: tAuth('register.reqLength'),
    reqUppercase: tAuth('register.reqUppercase'),
    reqLowercase: tAuth('register.reqLowercase'),
    reqDigit: tAuth('register.reqDigit'),
    reqSpecial: tAuth('register.reqSpecial'),
  }

  const onResetPassword = async ({ password }: { password: string; confirm: string }) => {
    try {
      await authService.resetPassword(email, collectedOtp, password)
      toast.success(t('resetSuccess'))

      // Bridge just the email to the login form so the user doesn't have to
      // retype it. NEVER persist the password — sessionStorage is readable by
      // any XSS on the page. The user re-enters the password they just set.
      try {
        sessionStorage.setItem(
          'pon:auth:prefill',
          JSON.stringify({ email, _ts: Date.now() }),
        )
      } catch {
        // sessionStorage may be blocked (incognito strict mode) — non-fatal.
      }

      router.push('/login')
    } catch (err: unknown) {
      const { code, params } = parseAuthError(err)
      const key = authCodeToI18nKey(code)
      toast.error(tAuth(key, params))
      // If OTP is wrong/expired the backend will reject here — send user back to OTP step.
      if (code === 'OTP_INVALID' || code === 'OTP_EXPIRED' || code === 'OTP_MAX_ATTEMPTS') {
        setOtp(Array(OTP_LENGTH).fill(''))
        setCollectedOtp('')
        setStep('otp')
      }
    }
  }

  // ── Shared back button ─────────────────────────────────────────
  const BackButton = ({ to }: { to: Step | '/login' }) => (
    <button
      type="button"
      onClick={() => (to === '/login' ? router.push('/login') : setStep(to as Step))}
      className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
    >
      <ArrowLeft className="mr-1 size-4" /> {t('backToLogin')}
    </button>
  )

  return (
    <Card className="w-full max-w-sm shadow-none border-border">

      {/* ── Step 1: email ── */}
      {step === 'request' && (
        <>
          <CardHeader>
            <div className="mb-2"><BackButton to="/login" /></div>
            <CardTitle className="text-2xl">{t('title')}</CardTitle>
            <CardDescription>{t('stepEmail')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitEmail(onRequestOtp)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">{tAuth('emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={tAuth('emailPlaceholder')}
                  autoComplete="email"
                  {...regEmail('email')}
                />
                {emailErrors.email && (
                  <p className="text-sm text-destructive">{emailErrors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full font-bold tracking-wide" disabled={emailSubmitting}>
                {emailSubmitting ? t('sendingCode') : t('sendCode')}
              </Button>
            </form>
          </CardContent>
        </>
      )}

      {/* ── Step 2: OTP ── */}
      {step === 'otp' && (
        <>
          <CardHeader>
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
              >
                <ArrowLeft className="mr-1 size-4" /> {t('back')}
              </button>
            </div>
            <CardTitle className="text-2xl">{t('otpTitle')}</CardTitle>
            <CardDescription>
              {t('otpSubtitle')}{' '}
              <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <OtpInput value={otp} onChange={setOtp} length={OTP_LENGTH} />
            {otpError && (
              <p className="text-sm text-destructive text-center">{otpError}</p>
            )}

            <Button onClick={onOtpNext} className="w-full font-bold tracking-wide">
              {t('otpNext')}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              {resendTimer > 0 ? (
                <span>{t('resendCountdown', { seconds: resendTimer })}</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="underline underline-offset-4 hover:text-primary cursor-pointer"
                >
                  {t('resend')}
                </button>
              )}
            </div>
          </CardContent>
        </>
      )}

      {/* ── Step 3: new password ── */}
      {step === 'reset' && (
        <>
          <CardHeader>
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setStep('otp')}
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
              >
                <ArrowLeft className="mr-1 size-4" /> {t('back')}
              </button>
            </div>
            <CardTitle className="text-2xl">{t('newPasswordTitle')}</CardTitle>
            <CardDescription>{t('newPasswordSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitReset(onResetPassword)} className="space-y-4">

              {/* New password */}
              <div className="space-y-1">
                <Label htmlFor="password">{t('newPasswordLabel')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-10"
                    {...regReset('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {resetErrors.password && (
                  <p className="text-sm text-destructive">{resetErrors.password.message}</p>
                )}
                <PasswordStrengthMeter password={passwordValue} labels={strengthLabels} />
              </div>

              {/* Confirm password */}
              <div className="space-y-1">
                <Label htmlFor="confirm">{t('confirmPasswordLabel')}</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-10"
                    {...regReset('confirm')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {resetErrors.confirm && (
                  <p className="text-sm text-destructive">{resetErrors.confirm.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full font-bold tracking-wide"
                disabled={resetSubmitting}
              >
                {resetSubmitting ? t('updating') : t('updatePassword')}
              </Button>
            </form>
          </CardContent>
        </>
      )}
    </Card>
  )
}
