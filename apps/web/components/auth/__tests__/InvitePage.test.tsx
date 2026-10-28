import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import InvitePage from '@/app/(auth)/invite/[token]/page'
import type { SsoInfo } from '@/lib/api/auth'
import type { InvitationPreview } from '@/lib/api/types'

const ssoInfo = vi.hoisted(() => ({
  value: { enabled: false, loginUrl: null, buttonLabel: '' } as SsoInfo,
}))
const nav = vi.hoisted(() => ({ search: '' }))

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'tok-1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`
    t.rich = (key: string) => key
    return t
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/notifications', () => ({ maybeRequestNotificationPermission: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({
  authService: {
    getInvitation: () =>
      Promise.resolve({
        email: 'jane@acme.com',
        workspaceName: 'Acme',
        inviterName: 'Olga',
        roleName: 'Member',
      } as InvitationPreview),
    getSsoInfo: () => Promise.resolve(ssoInfo.value),
    acceptInvitation: vi.fn(),
  },
}))

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <InvitePage />
    </QueryClientProvider>,
  )
}

const google = () => screen.queryByRole('button', { name: /auth\.invite\.continueWithGoogle/ })

beforeEach(() => {
  ssoInfo.value = { enabled: false, loginUrl: null, buttonLabel: '' }
  nav.search = ''
  sessionStorage.clear()
})

// QC 2026-10-26 (TC D-027): a cancelled / refused Google attempt comes back to
// the invitation instead of a raw JSON page or the login screen.
describe('/invite/[token]: back from a failed Google attempt', () => {
  it('?reason=SOCIAL_LOGIN_CANCELLED shows the notice above the form', async () => {
    nav.search = 'reason=SOCIAL_LOGIN_CANCELLED'
    renderPage()
    expect(await screen.findByTestId('invite-notice')).toHaveTextContent('auth.errSocialLoginCancelled')
  })

  it('an unrelated ?reason= is ignored', async () => {
    nav.search = 'reason=ACCOUNT_BLOCKED'
    renderPage()
    await screen.findByDisplayValue('jane@acme.com')
    expect(screen.queryByTestId('invite-notice')).toBeNull()
  })

  it('"Continue with Google" remembers this invitation before leaving', async () => {
    const realLocation = window.location
    const nav2 = { href: '' }
    Object.defineProperty(window, 'location', { configurable: true, value: nav2 })
    try {
      renderPage()
      await screen.findByDisplayValue('jane@acme.com')
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(await waitFor(() => google()!))
      await waitFor(() => expect(nav2.href).toContain('invite=tok-1'))
      expect(sessionStorage.getItem('pon:auth:invite-return')).toContain('"token":"tok-1"')
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
    }
  })
})

describe('/invite/[token]: Google option follows /auth/sso/info', () => {
  it('offers Google when the server enables it', async () => {
    ssoInfo.value = { ...ssoInfo.value, googleEnabled: true }
    renderPage()
    await screen.findByDisplayValue('jane@acme.com')
    await waitFor(() => expect(google()).not.toBeNull())
  })

  it('offers Google for an older server that does not say', async () => {
    renderPage()
    await screen.findByDisplayValue('jane@acme.com')
    expect(google()).not.toBeNull()
  })

  it('hides Google when the server says it is off', async () => {
    ssoInfo.value = { ...ssoInfo.value, googleEnabled: false }
    renderPage()
    await screen.findByDisplayValue('jane@acme.com')
    await waitFor(() => expect(google()).toBeNull())
    expect(screen.getByRole('button', { name: 'auth.invite.submit' })).toBeInTheDocument()
  })
})
