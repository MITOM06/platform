'use client'

import { Suspense } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { authService } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

function VerifyOtpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (resendTimer <= 0) return
    const id = setInterval(() => setResendTimer((t) => t - 1), 1000)
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
      toast.error('Vui lòng nhập đủ 6 chữ số')
      return
    }
    setLoading(true)
    try {
      await authService.verifyOtp(email, code)
      toast.success('Xác thực thành công! Vui lòng đăng nhập.')
      router.push('/login')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Mã OTP không hợp lệ'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    try {
      await authService.resendOtp(email)
      toast.success('Đã gửi lại mã OTP')
      setResendTimer(RESEND_COOLDOWN)
    } catch {
      toast.error('Không thể gửi lại mã OTP')
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-none border-border">
      <CardHeader>
        <CardTitle className="text-2xl">Xác thực OTP</CardTitle>
        <CardDescription>
          Nhập mã 6 chữ số đã được gửi đến{' '}
          <span className="font-medium text-foreground">{email || 'email của bạn'}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
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

          <Button
            type="submit"
            className="w-full font-bold tracking-wide"
            disabled={loading}
          >
            {loading ? 'Đang xác thực...' : 'Xác thực'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {resendTimer > 0 ? (
            <span>Gửi lại mã sau {resendTimer}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="underline underline-offset-4 hover:text-primary cursor-pointer"
            >
              Gửi lại mã OTP
            </button>
          )}
        </div>

        <p className="mt-2 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4 hover:text-primary">
            Quay lại đăng nhập
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
