import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import { toast } from 'sonner'
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'

const push = vi.fn()
const replace = vi.fn()
const forgotPassword = vi.fn()
const verifyOtp = vi.fn()
const resetPassword = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, params?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${params ? JSON.stringify(params) : ''}`,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    forgotPassword: (...a: unknown[]) => forgotPassword(...a),
    verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    resetPassword: (...a: unknown[]) => resetPassword(...a),
  },
}))

const EMAIL = 'alice@acme.com'
const NEW_PASSWORD = 'Secret#123'

function authError(code: string, params?: Record<string, unknown>) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status: 400, statusText: '', headers: {}, config, data: { code, params },
  } as AxiosResponse)
}

async function sendCode() {
  fireEvent.input(screen.getByLabelText('auth.emailLabel'), { target: { value: EMAIL } })
  fireEvent.click(screen.getByRole('button', { name: 'auth.forgotPassword.sendCode' }))
  await screen.findByText('auth.forgotPassword.otpTitle')
}

function typeCode(code: string) {
  const boxes = screen.getAllByRole('textbox')
  code.split('').forEach((digit, i) => fireEvent.change(boxes[i], { target: { value: digit } }))
}

function enteredCode() {
  return screen.getAllByRole('textbox').map((box) => (box as HTMLInputElement).value).join('')
}

function clickNext() {
  fireEvent.click(screen.getByRole('button', { name: 'auth.forgotPassword.otpNext' }))
}

describe('forgot password: the OTP step checks the code (mirror of mobile verify_otp_screen)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    forgotPassword.mockResolvedValue({})
    verifyOtp.mockResolvedValue({})
    resetPassword.mockResolvedValue({})
    render(<ForgotPasswordPage />)
  })

  it('a wrong code stays on the OTP step and says how many attempts remain', async () => {
    verifyOtp.mockRejectedValue(authError('OTP_WRONG_WITH_REMAINING', { remaining: 4 }))
    await sendCode()
    typeCode('000000')
    clickNext()

    expect(await screen.findByText('auth.errOtpWrongWithRemaining{"remaining":4}')).toBeInTheDocument()
    expect(verifyOtp).toHaveBeenCalledWith(EMAIL, '000000')
    expect(screen.queryByText('auth.forgotPassword.newPasswordTitle')).toBeNull()
    expect(enteredCode()).toBe('')
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('an expired code says so, and the code can be sent again', async () => {
    verifyOtp.mockRejectedValue(authError('OTP_EXPIRED'))
    await sendCode()
    typeCode('123456')
    clickNext()

    expect(await screen.findByText('auth.errOtpExpired')).toBeInTheDocument()
    expect(screen.getByText('auth.forgotPassword.otpTitle')).toBeInTheDocument()
    expect(screen.queryByText('auth.forgotPassword.newPasswordTitle')).toBeNull()
  })

  it('too many wrong attempts says so', async () => {
    verifyOtp.mockRejectedValue(authError('OTP_ATTEMPTS_EXCEEDED'))
    await sendCode()
    typeCode('000000')
    clickNext()

    expect(await screen.findByText('auth.errOtpAttemptsExceeded')).toBeInTheDocument()
    expect(screen.queryByText('auth.forgotPassword.newPasswordTitle')).toBeNull()
  })

  it('a failure that says nothing about the code keeps what was typed', async () => {
    verifyOtp.mockRejectedValue(new Error('offline'))
    await sendCode()
    typeCode('123456')
    clickNext()

    await waitFor(() => expect(verifyOtp).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('button', { name: 'auth.forgotPassword.otpNext' })).toBeEnabled())
    expect(enteredCode()).toBe('123456')
    expect(screen.queryByText('auth.forgotPassword.newPasswordTitle')).toBeNull()
  })

  it('an incomplete code never reaches the server', async () => {
    await sendCode()
    typeCode('123')
    clickNext()

    expect(await screen.findByText('auth.forgotPassword.otpMinLength')).toBeInTheDocument()
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('cannot be submitted twice while the code is being checked', async () => {
    verifyOtp.mockReturnValue(new Promise(() => {}))
    await sendCode()
    typeCode('123456')
    clickNext()

    const checking = await screen.findByRole('button', { name: 'auth.verifyOtp.submitting' })
    expect(checking).toBeDisabled()
    fireEvent.click(checking)
    expect(verifyOtp).toHaveBeenCalledTimes(1)
  })

  it('sending a new code clears the old error', async () => {
    verifyOtp.mockRejectedValue(authError('OTP_EXPIRED'))
    await sendCode()
    typeCode('123456')
    clickNext()
    await screen.findByText('auth.errOtpExpired')

    fireEvent.click(screen.getByRole('button', { name: 'auth.forgotPassword.back' }))
    await sendCode()

    expect(screen.queryByText('auth.errOtpExpired')).toBeNull()
  })

  it('a right code moves on, and the reset sends that same code with the new password', async () => {
    await sendCode()
    typeCode('123456')
    clickNext()
    await screen.findByText('auth.forgotPassword.newPasswordTitle')

    fireEvent.input(screen.getByLabelText('auth.forgotPassword.newPasswordLabel'), { target: { value: NEW_PASSWORD } })
    fireEvent.input(screen.getByLabelText('auth.forgotPassword.confirmPasswordLabel'), { target: { value: NEW_PASSWORD } })
    fireEvent.click(screen.getByRole('button', { name: 'auth.forgotPassword.updatePassword' }))

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith(EMAIL, '123456', NEW_PASSWORD))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('a code that expires while the new password is typed goes back to the OTP step', async () => {
    resetPassword.mockRejectedValue(authError('OTP_EXPIRED'))
    await sendCode()
    typeCode('123456')
    clickNext()
    await screen.findByText('auth.forgotPassword.newPasswordTitle')

    fireEvent.input(screen.getByLabelText('auth.forgotPassword.newPasswordLabel'), { target: { value: NEW_PASSWORD } })
    fireEvent.input(screen.getByLabelText('auth.forgotPassword.confirmPasswordLabel'), { target: { value: NEW_PASSWORD } })
    fireEvent.click(screen.getByRole('button', { name: 'auth.forgotPassword.updatePassword' }))

    await screen.findByText('auth.forgotPassword.otpTitle')
    expect(toast.error).toHaveBeenCalledWith('auth.errOtpExpired')
    expect(enteredCode()).toBe('')
  })
})
