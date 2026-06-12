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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type RequestOtpData = { email: string }
type ResetPasswordData = { otp: string; password: string }

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const requestSchema = useMemo(
    () => z.object({ email: z.string().email(tAuth('emailInvalid')) }),
    [tAuth],
  )

  const resetSchema = useMemo(
    () =>
      z.object({
        otp: z.string().min(6, t('otpMinLength')),
        password: z.string().min(6, t('newPasswordMin')),
      }),
    [t],
  )

  const {
    register: registerRequest,
    handleSubmit: handleSubmitRequest,
    formState: { errors: errorsRequest, isSubmitting: isSubmittingRequest },
  } = useForm<RequestOtpData>({ resolver: zodResolver(requestSchema) })

  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: errorsReset, isSubmitting: isSubmittingReset },
  } = useForm<ResetPasswordData>({ resolver: zodResolver(resetSchema) })

  const onRequestOtp = async (data: RequestOtpData) => {
    try {
      await authService.forgotPassword(data.email)
      setEmail(data.email)
      setStep('reset')
      toast.success(t('codeSent'))
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('sendError')
      toast.error(msg)
    }
  }

  const onResetPassword = async (data: ResetPasswordData) => {
    try {
      await authService.resetPassword(email, data.otp, data.password)
      toast.success(t('resetSuccess'))
      router.push('/login')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('resetError')
      toast.error(msg)
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-none border-border">
      <CardHeader>
        <div className="mb-2">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
          >
            <ArrowLeft className="mr-1 size-4" /> {t('backToLogin')}
          </Link>
        </div>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>
          {step === 'request' ? t('stepEmail') : t('stepOtp')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'request' ? (
          <form onSubmit={handleSubmitRequest(onRequestOtp)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">{tAuth('emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={tAuth('emailPlaceholder')}
                autoComplete="email"
                {...registerRequest('email')}
              />
              {errorsRequest.email && (
                <p className="text-sm text-destructive">{errorsRequest.email.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full font-bold tracking-wide"
              disabled={isSubmittingRequest}
            >
              {isSubmittingRequest ? t('sendingCode') : t('sendCode')}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmitReset(onResetPassword)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="otp">{t('otpLabel')}</Label>
              <Input
                id="otp"
                type="text"
                placeholder={t('otpPlaceholder')}
                maxLength={6}
                autoComplete="one-time-code"
                {...registerReset('otp')}
              />
              {errorsReset.otp && (
                <p className="text-sm text-destructive">{errorsReset.otp.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">{t('newPasswordLabel')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-10"
                  {...registerReset('password')}
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
              {errorsReset.password && (
                <p className="text-sm text-destructive">{errorsReset.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full font-bold tracking-wide"
              disabled={isSubmittingReset}
            >
              {isSubmittingReset ? t('updating') : t('updatePassword')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
