# Fix: Wallpaper Opacity + Forgot Password Flow

---

## Fix 1 — Increase wallpaper gradient opacity

**Problem:** All CSS gradient presets in `WALLPAPER_CLASSES` are too subtle — opacity values
are so low the chat background barely changes from the default.

**File:** `apps/web/lib/hooks/use-wallpaper.ts`

Replace the entire `WALLPAPER_CLASSES` constant with the version below.
Rule applied: light-mode stop values roughly **3×** the originals; dark-mode values **1.5–2×**.
`default` and the image-URL path are untouched.

```ts
const WALLPAPER_CLASSES: Record<string, string> = {
  // ── default ──
  default: 'bg-background',

  // ── original 5 ──
  sunset:
    'bg-gradient-to-br from-orange-400/30 via-pink-500/20 to-purple-600/30 dark:from-orange-800/50 dark:via-pink-900/35 dark:to-purple-900/50',
  midnight:
    'bg-gradient-to-br from-indigo-900/45 via-slate-800/55 to-purple-900/50 dark:from-indigo-950/70 dark:via-slate-950/80 dark:to-purple-950/75',
  sweet_pink:
    'bg-gradient-to-br from-pink-300/30 via-rose-400/20 to-red-400/30 dark:from-pink-900/50 dark:via-rose-950/40 dark:to-red-950/50',
  neon_teal:
    'bg-gradient-to-br from-teal-800/40 via-cyan-800/50 to-emerald-800/40 dark:from-teal-950/65 dark:via-cyan-950/75 dark:to-emerald-950/65',
  dark_shadow:
    'bg-gradient-to-br from-black/45 via-zinc-900/60 to-zinc-950/55 dark:from-black/80 dark:via-zinc-950/88 dark:to-zinc-950/90',

  // ── màu sắc đơn giản ──
  ocean_blue:
    'bg-gradient-to-br from-blue-800/40 via-sky-800/30 to-blue-800/50 dark:from-blue-950/70 dark:via-sky-950/60 dark:to-blue-950/80',
  forest_green:
    'bg-gradient-to-br from-green-800/40 via-emerald-800/30 to-green-800/50 dark:from-green-950/70 dark:via-emerald-950/60 dark:to-green-950/80',
  purple_haze:
    'bg-gradient-to-br from-purple-800/40 via-violet-800/30 to-fuchsia-800/40 dark:from-purple-950/70 dark:via-violet-950/60 dark:to-fuchsia-950/70',
  warm_amber:
    'bg-gradient-to-br from-amber-700/35 via-yellow-700/25 to-orange-700/35 dark:from-amber-900/60 dark:via-yellow-950/50 dark:to-orange-900/60',
  rose_gold:
    'bg-gradient-to-br from-rose-700/35 via-pink-700/25 to-amber-700/30 dark:from-rose-900/60 dark:via-pink-950/50 dark:to-amber-900/55',
  storm:
    'bg-gradient-to-br from-slate-700/45 via-blue-900/35 to-slate-700/50 dark:from-slate-950/75 dark:via-blue-950/65 dark:to-slate-950/80',
  cherry_blossom:
    'bg-gradient-to-br from-pink-300/25 via-pink-400/18 to-rose-300/25 dark:from-pink-900/55 dark:via-rose-950/45 dark:to-pink-900/55',
  midnight_purple:
    'bg-gradient-to-br from-purple-900/55 via-indigo-900/65 to-slate-900/70 dark:from-purple-950/80 dark:via-indigo-950/88 dark:to-slate-950/92',
  coral_reef:
    'bg-gradient-to-br from-red-700/40 via-orange-700/30 to-rose-800/40 dark:from-red-900/65 dark:via-orange-950/55 dark:to-rose-950/65',
  arctic_ice:
    'bg-gradient-to-br from-sky-300/25 via-blue-200/18 to-cyan-300/22 dark:from-sky-900/55 dark:via-blue-950/45 dark:to-cyan-950/55',

  // ── gradient sống động ──
  aurora:
    'bg-gradient-to-br from-teal-700/45 via-emerald-800/35 to-purple-700/45 dark:from-teal-950/72 dark:via-emerald-950/60 dark:to-purple-950/72',
  galaxy:
    'bg-gradient-to-br from-indigo-900/65 via-purple-900/55 to-slate-900/75 dark:from-indigo-950/88 dark:via-purple-950/80 dark:to-slate-950/92',
  fire_ice:
    'bg-gradient-to-br from-red-700/45 via-slate-800/40 to-blue-700/45 dark:from-red-900/68 dark:via-slate-950/70 dark:to-blue-900/68',
  tropical:
    'bg-gradient-to-br from-green-700/35 via-cyan-700/28 to-yellow-700/30 dark:from-green-900/62 dark:via-cyan-950/55 dark:to-yellow-900/58',
  candy:
    'bg-gradient-to-br from-pink-400/30 via-violet-400/22 to-cyan-400/25 dark:from-pink-900/55 dark:via-violet-950/48 dark:to-cyan-950/55',

  // ── tối giản ──
  pure_dark: 'bg-[#050507] dark:bg-[#030303]',
  soft_gray:
    'bg-gradient-to-br from-zinc-600/35 via-zinc-700/28 to-zinc-600/35 dark:from-zinc-800/70 dark:via-zinc-900/80 dark:to-zinc-800/70',
  warm_night:
    'bg-gradient-to-br from-zinc-900/60 via-purple-900/25 to-zinc-900/65 dark:from-zinc-950/82 dark:via-purple-950/45 dark:to-zinc-950/85',
}
```

**Verify:** Open the wallpaper picker, select each gradient preset — the chat background should
show a clearly visible coloured/gradient tint while message bubbles remain readable.
`pure_dark` should look near-black.

---

## Fix 2 — Forgot password: split into 3 steps (email → OTP → new password)

**Problem:** The web flow collapses OTP input + new password into a single step (`'reset'`).
Mobile shows them on separate screens. The fix splits into 3 distinct steps:
1. `'request'` — enter email → sends OTP
2. `'otp'` — enter 6-digit OTP → "Tiếp tục" stores OTP locally, advances to step 3
3. `'reset'` — enter new password + confirm → submits `resetPassword(email, otp, password)`

No backend changes needed — `resetPassword(email, otp, password)` already handles everything.

**File:** `apps/web/app/(auth)/forgot-password/page.tsx`

Replace the entire file content with:

```tsx
'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
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
    } catch {
      toast.error(t('resendError'))
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
```

### i18n keys to add

Add to `apps/web/messages/en.json` inside `"auth.forgotPassword"`:
```json
"back": "Back",
"otpTitle": "Enter verification code",
"otpSubtitle": "We sent a 6-digit code to",
"otpNext": "Continue",
"otpMinLength": "Please enter all 6 digits",
"resend": "Resend code",
"resendCountdown": "Resend in {seconds}s",
"resendError": "Failed to resend code",
"newPasswordTitle": "Set new password",
"newPasswordSubtitle": "Choose a strong password for your account.",
"confirmPasswordLabel": "Confirm password",
"passwordMismatch": "Passwords don't match"
```

Add Vietnamese equivalents to `apps/web/messages/vi.json`:
```json
"back": "Quay lại",
"otpTitle": "Nhập mã xác minh",
"otpSubtitle": "Chúng tôi đã gửi mã 6 chữ số đến",
"otpNext": "Tiếp tục",
"otpMinLength": "Vui lòng nhập đủ 6 chữ số",
"resend": "Gửi lại mã",
"resendCountdown": "Gửi lại sau {seconds}s",
"resendError": "Gửi lại thất bại",
"newPasswordTitle": "Đặt mật khẩu mới",
"newPasswordSubtitle": "Chọn một mật khẩu mạnh cho tài khoản của bạn.",
"confirmPasswordLabel": "Xác nhận mật khẩu",
"passwordMismatch": "Mật khẩu không khớp"
```

Add best-effort translations to remaining language files.

### Verify

1. Go to `/forgot-password`.
2. Enter email → toast "Code sent" → screen changes to OTP step (only OTP input, no password field).
3. Leave OTP empty → click Continue → error "Please enter all 6 digits".
4. Enter OTP → click Continue → screen changes to password step (only password + confirm, no OTP).
5. Enter non-matching passwords → error "Passwords don't match".
6. Enter valid matching password → submit → success toast → redirect to `/login`.
7. Enter valid OTP but wrong password format → error, stays on step 3.
8. Enter wrong OTP → submit on step 3 → backend rejects → user bounced back to step 2 (OTP cleared).
