'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { authService } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const requestOtpSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
})

const resetPasswordSchema = z.object({
  otp: z.string().min(6, 'Mã OTP phải có 6 ký tự'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
})

type RequestOtpData = z.infer<typeof requestOtpSchema>
type ResetPasswordData = z.infer<typeof resetPasswordSchema>

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<'request' | 'reset'>('request')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const {
    register: registerRequest,
    handleSubmit: handleSubmitRequest,
    formState: { errors: errorsRequest, isSubmitting: isSubmittingRequest },
  } = useForm<RequestOtpData>({ resolver: zodResolver(requestOtpSchema) })

  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: errorsReset, isSubmitting: isSubmittingReset },
  } = useForm<ResetPasswordData>({ resolver: zodResolver(resetPasswordSchema) })

  const onRequestOtp = async (data: RequestOtpData) => {
    try {
      await authService.forgotPassword(data.email)
      setEmail(data.email)
      setStep('reset')
      toast.success('Mã xác nhận đã được gửi đến email của bạn')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Không thể yêu cầu đặt lại mật khẩu'
      toast.error(msg)
    }
  }

  const onResetPassword = async (data: ResetPasswordData) => {
    try {
      await authService.resetPassword(email, data.otp, data.password)
      toast.success('Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập.')
      router.push('/login')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Mã OTP không hợp lệ hoặc đã hết hạn'
      toast.error(msg)
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-none border-border">
      <CardHeader>
        <div className="mb-2">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center">
            <ArrowLeft className="mr-1 size-4" /> Quay lại đăng nhập
          </Link>
        </div>
        <CardTitle className="text-2xl">Quên mật khẩu</CardTitle>
        <CardDescription>
          {step === 'request'
            ? 'Nhập email để nhận mã xác nhận đặt lại mật khẩu'
            : 'Nhập mã xác nhận đã được gửi vào email của bạn'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'request' ? (
          <form onSubmit={handleSubmitRequest(onRequestOtp)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ban@example.com"
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
              {isSubmittingRequest ? 'Đang gửi mã...' : 'Gửi mã xác nhận'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmitReset(onResetPassword)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="otp">Mã xác nhận (OTP)</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Nhập mã 6 số"
                maxLength={6}
                autoComplete="one-time-code"
                {...registerReset('otp')}
              />
              {errorsReset.otp && (
                <p className="text-sm text-destructive">{errorsReset.otp.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Mật khẩu mới</Label>
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
              {isSubmittingReset ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
