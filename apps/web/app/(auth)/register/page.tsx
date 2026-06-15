'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { authService } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter'
import { Checkbox } from '@/components/ui/checkbox'

type FormData = { displayName: string; email: string; password: string; confirmPassword: string; agreeToTerms: boolean }

export default function RegisterPage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordValue, setPasswordValue] = useState('')

  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? ''

  const schema = useMemo(
    () =>
      z
        .object({
          displayName: z.string().min(2, t('register.displayNameMin')),
          email: z.string().email(t('emailInvalid')),
          password: z
            .string()
            .min(8, t('register.passwordMin'))
            .regex(/[A-Z]/, t('register.reqUppercase'))
            .regex(/[a-z]/, t('register.reqLowercase'))
            .regex(/[0-9]/, t('register.reqDigit'))
            .regex(/[!@#$%^&*]/, t('register.reqSpecial')),
          confirmPassword: z.string(),
          agreeToTerms: z.boolean().refine((val) => val === true, {
            message: t('register.mustAgree'),
          }),
        })
        .refine((d) => d.password === d.confirmPassword, {
          message: t('register.confirmPasswordMismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ 
    resolver: zodResolver(schema),
    defaultValues: { agreeToTerms: false }
  })

  const onSubmit = async (data: FormData) => {
    try {
      await authService.register(data.email, data.password, data.displayName)
      toast.success(t('register.success'))
      router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`)
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } }
      const status = e?.response?.status
      const backendMsg = e?.response?.data?.message ?? ''
      if (status === 400 && backendMsg.toLowerCase().includes('domain')) {
        toast.error(t('register.emailDomainInvalid'))
      } else if (status === 409) {
        toast.error(t('register.emailExists'))
      } else {
        toast.error(backendMsg || t('register.error'))
      }
    }
  }

  const strengthLabels = {
    weak: t('register.pwStrengthWeak'),
    medium: t('register.pwStrengthMedium'),
    strong: t('register.pwStrengthStrong'),
    veryStrong: t('register.pwStrengthVeryStrong'),
    reqLength: t('register.reqLength'),
    reqUppercase: t('register.reqUppercase'),
    reqLowercase: t('register.reqLowercase'),
    reqDigit: t('register.reqDigit'),
    reqSpecial: t('register.reqSpecial'),
  }

  return (
    <Card className="w-full max-w-sm shadow-none border-border">
      <CardHeader>
        <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
        <CardDescription>{t('register.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="displayName">{t('register.displayNameLabel')}</Label>
            <Input
              id="displayName"
              placeholder={t('register.displayNamePlaceholder')}
              autoComplete="name"
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-sm text-destructive">{errors.displayName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">{t('emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              autoComplete="email"
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
                autoComplete="new-password"
                placeholder={t('register.passwordPlaceholder')}
                className="pr-10"
                {...register('password', {
                  onChange: (e) => setPasswordValue(e.target.value),
                })}
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
            <PasswordStrengthMeter password={passwordValue} labels={strengthLabels} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">{t('register.confirmPasswordLabel')}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={t('register.confirmPasswordPlaceholder')}
                className="pr-10"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md py-2">
            <Checkbox
              id="agreeToTerms"
              checked={watch('agreeToTerms')}
              onCheckedChange={(checked) => setValue('agreeToTerms', checked as boolean)}
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="agreeToTerms" className="font-normal text-sm text-muted-foreground cursor-pointer">
                {t.rich('register.agreeToTerms', {
                  privacyPolicy: (chunks) => <Link href="/privacy" target="_blank" className="text-primary hover:underline">{chunks}</Link>,
                  termsOfService: (chunks) => <Link href="/privacy" target="_blank" className="text-primary hover:underline">{chunks}</Link>
                })}
              </Label>
              {errors.agreeToTerms && (
                <p className="text-sm text-destructive">{errors.agreeToTerms.message}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full font-bold tracking-wide"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('register.submitting') : t('register.submit')}
          </Button>
        </form>

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
                {t('register.googleRegister')}
              </a>
              <a
                href={`${authUrl}/auth/social/facebook/init?platform=web`}
                className="flex items-center justify-center gap-2 w-full rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <svg className="h-4 w-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {t('register.facebookRegister')}
              </a>
            </div>
          </>
        )}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('register.hasAccount')}{' '}
          <Link href="/login" className="underline underline-offset-4 hover:text-primary">
            {t('register.loginLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
