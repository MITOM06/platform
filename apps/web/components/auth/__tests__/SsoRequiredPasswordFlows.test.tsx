import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import { toast } from 'sonner'
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'
import SecurityPage from '@/app/(main)/settings/security/page'
import { useAuthStore } from '@/lib/store/auth.store'

const push = vi.fn()
const replace = vi.fn()
const forgotPassword = vi.fn()
const changePassword = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    forgotPassword: (...a: unknown[]) => forgotPassword(...a),
    changePassword: (...a: unknown[]) => changePassword(...a),
    getMe: () => Promise.resolve({ id: 'u1', email: 'alice@acme.com', displayName: 'Alice', mfaRequired: false }),
  },
}))

function ssoRequired() {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status: 403, statusText: '', headers: {}, config, data: { code: 'SSO_REQUIRED' },
  } as AxiosResponse)
}

describe('passwords are off for an SSO-enforced domain (contract 13 C)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forgot password: SSO_REQUIRED goes to the login notice instead of a toast', async () => {
    forgotPassword.mockRejectedValue(ssoRequired())
    render(<ForgotPasswordPage />)
    fireEvent.input(screen.getByLabelText('auth.emailLabel'), { target: { value: 'alice@acme.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'auth.forgotPassword.sendCode' }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=SSO_REQUIRED'))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('Settings → Security: a password change answering SSO_REQUIRED shows this screen’s wording', async () => {
    changePassword.mockRejectedValue(ssoRequired())
    useAuthStore.setState({
      user: { id: 'u1', email: 'alice@acme.com', displayName: 'Alice', hasPassword: false },
      accessToken: 'tok',
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <SecurityPage />
      </QueryClientProvider>,
    )
    fireEvent.change(screen.getByLabelText('settings.security.passwordLabel'), { target: { value: 'Secret#123' } })
    fireEvent.change(screen.getByLabelText('settings.security.confirmLabel'), { target: { value: 'Secret#123' } })
    fireEvent.click(screen.getByRole('button', { name: 'settings.security.setButton' }))

    expect(await screen.findByText('settings.security.ssoPasswordDisabled')).toBeInTheDocument()
    expect(screen.queryByText(/SSO_REQUIRED/)).toBeNull()
  })
})
