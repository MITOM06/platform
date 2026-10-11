import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import { toast } from 'sonner'
import VerifyOtpPage from '@/app/(auth)/verify-otp/page'

const resendOtp = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('email=alice@acme.com'),
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/notifications', () => ({ maybeRequestNotificationPermission: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({
  authService: { verifyOtp: vi.fn(), resendOtp: (...a: unknown[]) => resendOtp(...a) },
}))

const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
function serverError(status: number, data: unknown) {
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

async function resend() {
  render(<VerifyOtpPage />)
  act(() => {
    vi.advanceTimersByTime(61_000) // the resend cooldown
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'auth.verifyOtp.resend' }))
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => vi.useRealTimers())

describe('/verify-otp resend', () => {
  it('explains a typed refusal (too many OTP requests)', async () => {
    resendOtp.mockRejectedValue(serverError(429, { code: 'TOO_MANY_OTP_REQUESTS' }))
    await resend()
    expect(toast.error).toHaveBeenCalledWith('auth.errTooManyOtpRequests')
  })

  it('a throttled resend says to slow down', async () => {
    resendOtp.mockRejectedValue(serverError(429, { statusCode: 429, message: 'ThrottlerException' }))
    await resend()
    expect(toast.error).toHaveBeenCalledWith('auth.errTooManyRequests')
  })

  it('an unknown failure keeps the resend-specific message', async () => {
    resendOtp.mockRejectedValue(serverError(500, { message: 'boom' }))
    await resend()
    expect(toast.error).toHaveBeenCalledWith('auth.verifyOtp.resendError')
  })
})
