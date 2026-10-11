import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import { toast } from 'sonner'
import LoginPage from '@/app/(auth)/login/page'
import { useAuthStore } from '@/lib/store/auth.store'
import type { SsoInfo } from '@/lib/api/auth'

const push = vi.fn()
const login = vi.fn()
const ssoInfo = vi.hoisted(() => ({
  value: { enabled: false, loginUrl: null, buttonLabel: '' } as SsoInfo,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/lib/notifications', () => ({ maybeRequestNotificationPermission: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    login: (...a: unknown[]) => login(...a),
    getSsoInfo: () => Promise.resolve(ssoInfo.value),
  },
}))

const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
function serverError(status: number, data: unknown) {
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <LoginPage />
    </QueryClientProvider>,
  )
}

function submitLogin() {
  fireEvent.input(screen.getByLabelText('auth.emailLabel'), { target: { value: 'alice@acme.com' } })
  fireEvent.input(screen.getByLabelText('auth.passwordLabel'), { target: { value: 'Secret#123' } })
  fireEvent.click(screen.getByRole('button', { name: 'auth.login.submit' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  ssoInfo.value = { enabled: false, loginUrl: null, buttonLabel: '' }
  useAuthStore.setState({ user: null, accessToken: null })
})

describe('login: failures that carry no business code', () => {
  it('a throttled sign-in (429) says to slow down, not "an error occurred"', async () => {
    login.mockRejectedValue(serverError(429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' }))
    renderLogin()
    submitLogin()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('auth.errTooManyRequests'))
    expect(screen.queryByText(/Throttler/)).toBeNull()
  })

  it('no connection says so', async () => {
    login.mockRejectedValue(new axios.AxiosError('Network Error', 'ERR_NETWORK', config))
    renderLogin()
    submitLogin()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('auth.errNetwork'))
  })
})

describe('login: Google sign-in button', () => {
  const google = () => screen.queryByRole('link', { name: /auth\.login\.googleLogin/ })

  it('is shown when the server enables Google sign-in', async () => {
    ssoInfo.value = { enabled: false, loginUrl: null, buttonLabel: '', googleEnabled: true }
    renderLogin()
    await waitFor(() => expect(google()).not.toBeNull())
    expect(google()!.getAttribute('href')).toMatch(/\/auth\/social\/google\/init\?platform=web$/)
  })

  it('is shown for an older server that does not say (googleEnabled absent)', async () => {
    renderLogin()
    await waitFor(() => expect(google()).not.toBeNull())
  })

  it('is hidden, with its "or continue with" divider, when Google sign-in is off', async () => {
    ssoInfo.value = { enabled: false, loginUrl: null, buttonLabel: '', googleEnabled: false }
    renderLogin()
    await waitFor(() => expect(google()).toBeNull())
    expect(screen.queryByText('auth.login.orContinueWith')).toBeNull()
  })
})
