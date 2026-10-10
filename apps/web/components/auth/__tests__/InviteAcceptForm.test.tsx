import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import axios from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import React from 'react'
import { toast } from 'sonner'
import { InviteAcceptForm } from '@/components/auth/InviteAcceptForm'
import { useAuthStore } from '@/lib/store/auth.store'
import { clearPendingMfa, readPendingMfa } from '@/lib/auth/mfa'
import { maybeRequestNotificationPermission } from '@/lib/notifications'
import type { InvitationPreview } from '@/lib/api/types'

const replace = vi.fn()
const acceptInvitation = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`
    t.rich = (key: string) => key
    return t
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/lib/notifications', () => ({ maybeRequestNotificationPermission: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({
  authService: { acceptInvitation: (...a: unknown[]) => acceptInvitation(...a) },
}))

const preview = {
  email: 'jane@acme.com',
  workspaceName: 'Acme',
  inviterName: 'Olga',
  roleName: 'Member',
} as InvitationPreview

const challenge = {
  code: 'MFA_REQUIRED',
  mfaToken: 'mfa-tok',
  enrollmentRequired: true,
  user: { id: 'j1', email: 'jane@acme.com', displayName: 'Jane' },
}

function serverError(status: number, data: unknown) {
  const config = { headers: new axios.AxiosHeaders() } as InternalAxiosRequestConfig
  return new axios.AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
    status, statusText: '', headers: {}, config, data,
  } as AxiosResponse)
}

function fillAndSubmit() {
  fireEvent.input(screen.getByLabelText('auth.password.displayNameLabel'), { target: { value: 'Jane' } })
  fireEvent.input(screen.getByLabelText('auth.passwordLabel'), { target: { value: 'Secret#123' } })
  fireEvent.input(screen.getByLabelText('auth.password.confirmPasswordLabel'), { target: { value: 'Secret#123' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'auth.invite.submit' }))
}

describe('InviteAcceptForm: accept with a password (contracts 13 C, 15)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    clearPendingMfa()
    sessionStorage.clear()
    useAuthStore.setState({ user: null, accessToken: null })
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('Owner/Admin-like invite → MFA_REQUIRED: parks the enrollment and goes to /mfa without a session', async () => {
    acceptInvitation.mockResolvedValue(challenge)
    render(<InviteAcceptForm token="tok-1" preview={preview} />)
    fillAndSubmit()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/mfa'))
    expect(acceptInvitation).toHaveBeenCalledWith('tok-1', 'Jane', 'Secret#123')
    expect(readPendingMfa()).toMatchObject({ mfaToken: 'mfa-tok', enrollmentRequired: true })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })

  it('Member invite (2FA optional): the token answer signs in right away, like a password login', async () => {
    acceptInvitation.mockResolvedValue({
      code: 'INVITATION_ACCEPTED',
      accessToken: 'acc',
      refreshToken: 'ref',
      sid: 'sid',
      user: { id: 'j1', email: 'jane@acme.com', displayName: 'Jane' },
    })
    render(<InviteAcceptForm token="tok-1" preview={preview} />)
    fillAndSubmit()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    // Same session path as /login: httpOnly cookies via the route, token in memory.
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/set-cookie',
      expect.objectContaining({ body: JSON.stringify({ accessToken: 'acc', refreshToken: 'ref', sid: 'sid' }) }),
    )
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'acc', user: { id: 'j1' } })
    expect(toast.success).toHaveBeenCalledWith('auth.invite.welcome:{"workspace":"Acme"}')
    expect(maybeRequestNotificationPermission).toHaveBeenCalled()
    expect(readPendingMfa()).toBeNull()
  })

  it('a token answer for an account that must still create its password lands on /set-password', async () => {
    acceptInvitation.mockResolvedValue({
      accessToken: 'acc',
      refreshToken: 'ref',
      sid: 'sid',
      user: { id: 'j1', email: 'jane@acme.com', displayName: 'Jane', mustSetPassword: true },
    })
    render(<InviteAcceptForm token="tok-1" preview={preview} />)
    fillAndSubmit()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/set-password'))
  })

  it('SSO_REQUIRED: replaces the options with the SSO notice and an emphasised SSO button', async () => {
    acceptInvitation.mockRejectedValue(serverError(403, { code: 'SSO_REQUIRED' }))
    render(<InviteAcceptForm token="tok-1" preview={preview} />)
    fillAndSubmit()

    const notice = await screen.findByTestId('sso-required-notice')
    expect(notice).toHaveTextContent('auth.invite.ssoRequired:{"workspace":"Acme"}')
    const sso = screen.getByTestId('sso-button')
    expect(sso).toHaveAttribute('data-emphasised', 'true')
    expect(sso.getAttribute('href')).toMatch(/\/auth\/oidc\/login\?platform=web$/)
    // Password + Google paths would fail the same way — they are gone.
    expect(screen.queryByRole('button', { name: 'auth.invite.submit' })).toBeNull()
    expect(screen.queryByText('auth.invite.continueWithGoogle')).toBeNull()
    // The invitation context stays visible.
    expect(screen.getByDisplayValue('jane@acme.com')).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('other errors stay a localized toast and keep the form', async () => {
    acceptInvitation.mockRejectedValue(serverError(410, { code: 'INVITATION_EXPIRED' }))
    render(<InviteAcceptForm token="tok-1" preview={preview} />)
    fillAndSubmit()

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('auth.errInvitationExpired'))
    expect(screen.queryByTestId('sso-required-notice')).toBeNull()
    expect(screen.getByRole('button', { name: 'auth.invite.submit' })).toBeInTheDocument()
  })
})
