'use client'

import { Suspense } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/auth'
import { maybeRequestNotificationPermission } from '@/lib/notifications'
import { parseAuthError, authCodeToI18nKey } from '@/lib/auth/auth-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

function VerifyOtpForm() {
  const t = useTranslations('auth.verifyOtp')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setInterval(() => setResendTimer((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [resendTimer])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    const next = [...otp]
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setOtp(next)
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < OTP_LENGTH) {
      toast.error(t('incomplete'))
      return
    }
    setLoading(true)
    try {
      await authService.verifyOtp(email, code)
      toast.success(t('success'))
      // Prompt for notification permission after successful account verification.
      void maybeRequestNotificationPermission()
      router.push('/login')
    } catch (err: unknown) {
      const { code, params } = parseAuthError(err)
      toast.error(tAuth(authCodeToI18nKey(code), params))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    try {
      await authService.resendOtp(email)
      toast.success(t('resendSuccess'))
      setResendTimer(RESEND_COOLDOWN)
    } catch {
      toast.error(t('resendError'))
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-none border-border">
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>
          {t('subtitle')}{' '}
          <span className="font-medium text-foreground">{email || t('emailFallback')}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 motion-safe:pon-stagger">
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <Input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-xl font-bold rounded-2xl"
              />
            ))}
          </div>

          <Button type="submit" className="w-full font-bold tracking-wide" disabled={loading}>
            {loading ? t('submitting') : t('submit')}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
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

        <p className="mt-2 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4 hover:text-primary">
            {t('backToLogin')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  )
}
