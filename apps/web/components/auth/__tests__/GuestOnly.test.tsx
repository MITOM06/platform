import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { GuestOnly } from '@/components/auth/GuestOnly'
import { useAuthStore } from '@/lib/store/auth.store'
import { isGuestOnlyPath } from '@/lib/auth/guest-paths'

const replace = vi.fn()
const nav = vi.hoisted(() => ({ pathname: '/login' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => nav.pathname,
}))

const alice = { id: 'u1', email: 'alice@acme.com', displayName: 'Alice' }

function renderGuestOnly() {
  return render(
    <GuestOnly>
      <p>sign-in form</p>
    </GuestOnly>,
  )
}

/**
 * QC 2026-10-27: after signing in, Back showed the login form again until a
 * reload — Back is a client-side navigation, so the middleware never ran.
 */
describe('GuestOnly: sign-in pages are for guests', () => {
  beforeEach(() => {
    replace.mockClear()
    nav.pathname = '/login'
    useAuthStore.setState({ user: null, accessToken: null })
  })

  it('a guest sees the page', () => {
    renderGuestOnly()
    expect(screen.getByText('sign-in form')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('opened while signed in (Back from the app) → leaves for the app, form never shown', () => {
    useAuthStore.setState({ user: alice, accessToken: 'acc' })
    renderGuestOnly()
    expect(screen.queryByText('sign-in form')).toBeNull()
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('a sign-in completing on the page is not overridden (the page navigates on itself)', () => {
    renderGuestOnly()
    act(() => useAuthStore.getState().setAuth(alice, 'acc'))
    expect(screen.getByText('sign-in form')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('moving to another guest page while signed in → leaves for the app', () => {
    const { rerender } = renderGuestOnly()
    act(() => useAuthStore.getState().setAuth(alice, 'acc'))
    nav.pathname = '/forgot-password'
    rerender(
      <GuestOnly>
        <p>sign-in form</p>
      </GuestOnly>,
    )
    expect(replace).toHaveBeenCalledWith('/')
    expect(screen.queryByText('sign-in form')).toBeNull()
  })

  it('the shared list covers every sign-in page and nothing in the app', () => {
    for (const p of ['/login', '/invite/tok', '/verify-otp', '/oauth-callback', '/forgot-password', '/mfa']) {
      expect(isGuestOnlyPath(p)).toBe(true)
    }
    for (const p of ['/', '/conversations', '/set-password', '/privacy']) {
      expect(isGuestOnlyPath(p)).toBe(false)
    }
  })
})
