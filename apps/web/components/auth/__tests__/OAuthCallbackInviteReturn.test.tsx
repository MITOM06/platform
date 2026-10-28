import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React from 'react'
import OAuthCallbackPage from '@/app/(auth)/oauth-callback/page'
import { rememberInviteReturn } from '@/lib/auth/invite-return'

const replace = vi.fn()
const nav = vi.hoisted(() => ({ search: '' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/api/auth', () => ({ authService: { exchangeCode: vi.fn(() => new Promise(() => {})) } }))

/**
 * QC 2026-10-26 (TC D-027): cancelling Google on an invitation showed a raw
 * JSON page. The auth-service now redirects with `?error=`; a Google attempt
 * started from an invitation goes back to that invitation to try again.
 */
describe('/oauth-callback: cancelled / refused Google sign-in', () => {
  beforeEach(() => {
    replace.mockClear()
    sessionStorage.clear()
  })

  it('started from an invitation → back to that invitation with the notice', async () => {
    rememberInviteReturn('tok-1')
    nav.search = 'error=SOCIAL_LOGIN_CANCELLED'
    render(<OAuthCallbackPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/invite/tok-1?reason=SOCIAL_LOGIN_CANCELLED'))
  })

  it('a plain Google sign-in → the login notice', async () => {
    nav.search = 'error=SOCIAL_LOGIN_FAILED'
    render(<OAuthCallbackPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=SOCIAL_LOGIN_FAILED'))
  })

  it('other invitation errors keep landing on the login notice', async () => {
    rememberInviteReturn('tok-1')
    nav.search = 'error=INVITATION_EMAIL_MISMATCH'
    render(<OAuthCallbackPage />)
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?reason=INVITATION_EMAIL_MISMATCH'))
  })

  it('a successful return forgets the invitation', async () => {
    rememberInviteReturn('tok-1')
    nav.search = 'code=one-time'
    render(<OAuthCallbackPage />)
    await waitFor(() => expect(sessionStorage.getItem('pon:auth:invite-return')).toBeNull())
  })
})
