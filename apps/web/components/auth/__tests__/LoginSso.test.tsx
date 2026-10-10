import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import { toast } from 'sonner'
import LoginPage from '@/app/(auth)/login/page'
import OAuthCallbackPage from '@/app/(auth)/oauth-callback/page'
import { useAuthStore } from '@/lib/store/auth.store'
import type { SsoInfo } from '@/lib/api/auth'

const push = vi.fn()
const replace = vi.fn()
const login = vi.fn()
const nav = vi.hoisted(() => ({ search: '' }))
const ssoInfo = vi.hoisted(() => ({
  value: { enabled: false, loginUrl: null, buttonLabel: '' } as SsoInfo,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/lib/notifications', () => ({ maybeRequestNotificationPermission: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    login: (...a: unknown[]) => login(...a),
    exchangeCode: vi.fn(),
    getSsoInfo: () => Promise.resolve(ssoInfo.value),
  },
}))

function serverError(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
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

describe('login: single sign-on required (contract 13 C)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    nav.search = ''
    ssoInfo.value = { enabled: false, loginUrl: null, buttonLabel: '' }
    useAuthStore.setState({ user: null, accessToken: null })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('?reason=SSO_REQUIRED (forced logout / Google redirect) shows the notice and an emphasised SSO button', async () => {
    nav.search = 'reason=SSO_REQUIRED'
    renderLogin()

    expect(screen.getByTestId('sso-required-notice')).toHaveTextContent('auth.errSsoRequired')
    expect(screen.queryByTestId('logout-reason')).toBeNull()
    // Shown even before /auth/sso/info answers — the server already said SSO is the way in.
    const sso = screen.getByTestId('sso-button')
    expect(sso).toHaveAttribute('data-emphasised', 'true')
    expect(sso.getAttribute('href')).toMatch(/\/auth\/oidc\/login\?platform=web$/)
    expect(screen.getByText('auth.login.orSignInWithPassword')).toBeInTheDocument()
    expect(screen.getAllByTestId('sso-button')).toHaveLength(1)
  })

  it('a password sign-in answering 403 SSO_REQUIRED switches to the notice, with no toast and no session', async () => {
    login.mockRejectedValue(serverError(403, { code: 'SSO_REQUIRED' }))
    renderLogin()
    expect(screen.queryByTestId('sso-required-notice')).toBeNull()
    expect(screen.queryByTestId('sso-button')).toBeNull()

    submitLogin()

    expect(await screen.findByTestId('sso-required-notice')).toHaveTextContent('auth.errSsoRequired')
    expect(screen.getByTestId('sso-button')).toHaveAttribute('data-emphasised', 'true')
    expect(toast.error).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().accessToken).toBeNull()
    // The password is cleared; the raw server body never renders.
    expect(screen.getByLabelText('auth.passwordLabel')).toHaveValue('')
    expect(screen.queryByText(/SSO_REQUIRED/)).toBeNull()
  })

  it('emphasises the SSO button when the workspace requires SSO (no notice yet)', async () => {
    ssoInfo.value = { enabled: true, enforced: true, loginUrl: '/auth/oidc/login', buttonLabel: '' }
    renderLogin()

    const sso = await screen.findByTestId('sso-button')
    expect(sso).toHaveAttribute('data-emphasised', 'true')
    expect(screen.getByText('auth.login.orSignInWithPassword')).toBeInTheDocument()
    expect(screen.queryByTestId('sso-required-notice')).toBeNull()
  })

  it('keeps the plain SSO button below the form when SSO is on but not required', async () => {
    ssoInfo.value = { enabled: true, enforced: false, loginUrl: '/auth/oidc/login', buttonLabel: '' }
    renderLogin()

    const sso = await screen.findByTestId('sso-button')
    expect(sso).toHaveAttribute('data-emphasised', 'false')
    expect(screen.queryByText('auth.login.orSignInWithPassword')).toBeNull()
  })

  it('shows no SSO button when SSO is off and nothing requires it', async () => {
    renderLogin()
    await waitFor(() => expect(screen.getByRole('button', { name: 'auth.login.submit' })).toBeInTheDocument())
    expect(screen.queryByTestId('sso-button')).toBeNull()
  })

  it('other notices keep the error banner', () => {
    nav.search = 'reason=ACCOUNT_BLOCKED'
    renderLogin()
    expect(screen.getByTestId('logout-reason')).toHaveTextContent('auth.errAccountBlocked')
    expect(screen.queryByTestId('sso-required-notice')).toBeNull()
  })

  it('oauth-callback: a Google sign-in rejected with SSO_REQUIRED lands on the login notice', async () => {
    nav.search = 'error=SSO_REQUIRED'
    render(<OAuthCallbackPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=SSO_REQUIRED'))
  })
})
