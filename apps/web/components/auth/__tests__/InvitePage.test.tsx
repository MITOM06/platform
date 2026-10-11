import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import InvitePage from '@/app/(auth)/invite/[token]/page'
import type { SsoInfo } from '@/lib/api/auth'
import type { InvitationPreview } from '@/lib/api/types'

const ssoInfo = vi.hoisted(() => ({
  value: { enabled: false, loginUrl: null, buttonLabel: '' } as SsoInfo,
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'tok-1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
