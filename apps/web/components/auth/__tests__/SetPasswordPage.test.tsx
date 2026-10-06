import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import SetPasswordPage from '@/app/(onboarding)/set-password/page'
import { useAuthStore, type AuthUser } from '@/lib/store/auth.store'

const replace = vi.fn()
const push = vi.fn()
const changePassword = vi.fn()
const getMe = vi.fn()
const toastSuccess = vi.fn()
const toastError = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/set-password',
}))
// Namespaced keys make "went through the translator" visible in assertions.
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    changePassword: (...args: unknown[]) => changePassword(...args),
    getMe: () => getMe(),
  },
}))

const STRONG = 'Str0ng!pass'
const user: AuthUser = { id: 'u1', email: 'jane@acme.com', displayName: 'Jane', hasPassword: false, mustSetPassword: true }

function serverError(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

function fill(password: string, confirm = password) {
  fireEvent.input(screen.getByLabelText('auth.setPassword.newPasswordLabel'), { target: { value: password } })
  fireEvent.input(screen.getByLabelText('auth.password.confirmPasswordLabel'), { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: 'auth.setPassword.submit' }))
}

describe('/set-password page', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user, accessToken: 'tok' })
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('explains the step and shows the account email', () => {
    render(<SetPasswordPage />)
    expect(screen.getByText('auth.setPassword.title')).toBeInTheDocument()
    expect(screen.getByText('auth.setPassword.subtitle')).toBeInTheDocument()
    expect(screen.getByLabelText('auth.emailLabel')).toHaveValue('jane@acme.com')
  })

  it('offers no way to skip: only "create" and "sign out", no link into the app', () => {
    render(<SetPasswordPage />)
    const named = screen
      .getAllByRole('button')
      .map((b) => b.textContent?.trim())
      .filter(Boolean)
    expect(named).toEqual(['auth.setPassword.submit', 'layout.menuLogout'])
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryByText(/skip|later/i)).not.toBeInTheDocument()
  })

  it('rejects a short password with the localized message and does not call the API', async () => {
    render(<SetPasswordPage />)
    fill('Ab1!')
    expect(await screen.findByText('auth.password.passwordMin')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('rejects a mismatched confirmation', async () => {
    render(<SetPasswordPage />)
    fill(STRONG, `${STRONG}x`)
    expect(await screen.findByText('auth.password.confirmPasswordMismatch')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('sets the password without a current one, refreshes the user and goes home', async () => {
    changePassword.mockResolvedValue({ data: { success: true } })
    getMe.mockResolvedValue({ ...user, hasPassword: true, mustSetPassword: false, bio: 'hi' })
    render(<SetPasswordPage />)
    fill(STRONG)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(changePassword).toHaveBeenCalledWith(undefined, STRONG)
    expect(getMe).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('auth.setPassword.success')
    expect(useAuthStore.getState().user).toMatchObject({ mustSetPassword: false, hasPassword: true, bio: 'hi' })
  })

  it('still clears the flag locally when /me is unreachable after success', async () => {
    changePassword.mockResolvedValue({ data: { success: true } })
    getMe.mockRejectedValue(new Error('network'))
    render(<SetPasswordPage />)
    fill(STRONG)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(useAuthStore.getState().user).toMatchObject({ id: 'u1', mustSetPassword: false, hasPassword: true })
  })

  it('shows the localized server error for a typed code and stays on the page', async () => {
    changePassword.mockRejectedValue(serverError(400, { code: 'VAL_PASSWORD_TOO_SHORT' }))
    render(<SetPasswordPage />)
    fill(STRONG)

    expect(await screen.findByRole('alert')).toHaveTextContent('auth.errValPasswordTooShort')
    expect(replace).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user?.mustSetPassword).toBe(true)
  })

  it('never renders raw server text', async () => {
    changePassword.mockRejectedValue(serverError(500, { message: 'MongoServerError: boom' }))
    render(<SetPasswordPage />)
    fill(STRONG)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('auth.errGeneric')
    expect(alert).not.toHaveTextContent(/Mongo/)
  })

  it('signs out to the login screen', async () => {
    render(<SetPasswordPage />)
    fireEvent.click(screen.getByRole('button', { name: 'layout.menuLogout' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login?cleared=1'))
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/clear-cookie', { method: 'POST' })
    expect(useAuthStore.getState().user).toBeNull()
    expect(changePassword).not.toHaveBeenCalled()
  })
})
