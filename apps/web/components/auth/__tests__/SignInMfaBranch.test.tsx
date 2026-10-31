import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import LoginPage from '@/app/(auth)/login/page'
import OAuthCallbackPage from '@/app/(auth)/oauth-callback/page'
import { useAuthStore } from '@/lib/store/auth.store'
import { clearPendingMfa, readPendingMfa } from '@/lib/auth/mfa'
import { isSsoReauthDue, markSsoReauth } from '@/lib/auth/sso-reauth'

const push = vi.fn()
const replace = vi.fn()
const login = vi.fn()
const exchangeCode = vi.fn()
const nav = vi.hoisted(() => ({ search: '' }))

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
    exchangeCode: (...a: unknown[]) => exchangeCode(...a),
    getSsoInfo: () => Promise.resolve({ enabled: false, loginUrl: null, buttonLabel: '' }),
  },
}))

const challenge = {
  code: 'MFA_REQUIRED',
  mfaToken: 'mfa-tok',
  enrollmentRequired: false,
  user: { id: 'o1', email: 'owner@acme.com', displayName: 'Olga' },
}
const tokens = {
  code: 'LOGIN_SUCCESS',
  accessToken: 'acc',
  refreshToken: 'ref',
  sid: 'sid',
  user: { id: 'm1', email: 'member@acme.com', displayName: 'Mia' },
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function submitLogin() {
  fireEvent.input(screen.getByLabelText('auth.emailLabel'), { target: { value: 'owner@acme.com' } })
  fireEvent.input(screen.getByLabelText('auth.passwordLabel'), { target: { value: 'Secret#123' } })
  fireEvent.click(screen.getByRole('button', { name: 'auth.login.submit' }))
}

describe('sign-in screens → 2FA step', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    nav.search = ''
    clearPendingMfa()
    sessionStorage.clear()
    useAuthStore.setState({ user: null, accessToken: null })
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('login: MFA_REQUIRED parks the challenge and routes to /mfa without creating a session', async () => {
    login.mockResolvedValue({ data: challenge })
    renderWithQuery(<LoginPage />)
    submitLogin()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/mfa'))
    expect(login).toHaveBeenCalledWith('owner@acme.com', 'Secret#123')
    expect(readPendingMfa()).toMatchObject({ mfaToken: 'mfa-tok', enrollmentRequired: false })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('login: an account the server exempts from 2FA still signs in directly', async () => {
    login.mockResolvedValue({ data: tokens })
    renderWithQuery(<LoginPage />)
    submitLogin()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/set-cookie', expect.objectContaining({ method: 'POST' }))
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'acc', user: { id: 'm1' } })
    expect(readPendingMfa()).toBeNull()
  })

  it('oauth-callback: a Google sign-in answering MFA_REQUIRED goes to /mfa (enrollment kept)', async () => {
    nav.search = 'code=login-code'
    exchangeCode.mockResolvedValue({ data: { ...challenge, enrollmentRequired: true } })
    render(<OAuthCallbackPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/mfa'))
    expect(exchangeCode).toHaveBeenCalledWith('login-code')
    expect(readPendingMfa()).toMatchObject({ mfaToken: 'mfa-tok', enrollmentRequired: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('oauth-callback: tokens still land on the post-sign-in path (set-password gate)', async () => {
    nav.search = 'code=login-code'
    exchangeCode.mockResolvedValue({ data: { ...tokens, user: { ...tokens.user, mustSetPassword: true } } })
    render(<OAuthCallbackPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/set-password'))
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/set-cookie', expect.anything())
  })

  describe('oauth-callback and the "re-authenticate on the next SSO" flag', () => {
    beforeEach(() => {
      localStorage.clear()
      markSsoReauth()
      nav.search = 'code=login-code'
    })

    it('a successful SSO sign-in clears it', async () => {
      exchangeCode.mockResolvedValue({ data: { ...tokens, method: 'oidc' } })
      render(<OAuthCallbackPage />)
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
      expect(isSsoReauthDue()).toBe(false)
    })

    // The IdP session may still be the previous person's: only the IdP having
    // just signed someone in makes a silent SSO safe again.
    it.each([
      ['a Google sign-in', { ...tokens, method: 'google' }],
      ['an older server that sends no method', tokens],
    ])('%s keeps it', async (_label, data) => {
      exchangeCode.mockResolvedValue({ data })
      render(<OAuthCallbackPage />)
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
      expect(isSsoReauthDue()).toBe(true)
    })

    it('a Google sign-in stopping at the 2FA step keeps it', async () => {
      exchangeCode.mockResolvedValue({ data: challenge })
      render(<OAuthCallbackPage />)
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/mfa'))
      expect(isSsoReauthDue()).toBe(true)
    })

    it('a failed exchange keeps it', async () => {
      exchangeCode.mockRejectedValue(new Error('boom'))
      render(<OAuthCallbackPage />)
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
      expect(isSsoReauthDue()).toBe(true)
    })

    it('an IdP that refused the sign-in keeps it', async () => {
      nav.search = 'error=OIDC_EXCHANGE_FAILED'
      render(<OAuthCallbackPage />)
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=OIDC_EXCHANGE_FAILED'))
      expect(exchangeCode).not.toHaveBeenCalled()
      expect(isSsoReauthDue()).toBe(true)
    })

    it('a session that could not be established keeps it', async () => {
      fetchMock.mockRejectedValue(new Error('offline'))
      exchangeCode.mockResolvedValue({ data: { ...tokens, method: 'oidc' } })
      render(<OAuthCallbackPage />)
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
      expect(isSsoReauthDue()).toBe(true)
    })
  })
})
