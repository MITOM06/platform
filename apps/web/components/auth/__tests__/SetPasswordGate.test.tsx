import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { SetPasswordGate } from '@/components/auth/SetPasswordGate'
import { useAuthStore, type AuthUser } from '@/lib/store/auth.store'

const replace = vi.fn()
let pathname = '/conversations'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathname,
}))
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))

const baseUser: AuthUser = { id: 'u1', email: 'jane@acme.com', displayName: 'Jane' }

function renderGate() {
  return render(
    <SetPasswordGate>
      <div>app shell</div>
    </SetPasswordGate>,
  )
}

describe('SetPasswordGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathname = '/conversations'
    useAuthStore.setState({ user: null, accessToken: null })
  })

  it('holds a flagged user: no app shell, redirect to /set-password', () => {
    useAuthStore.setState({ user: { ...baseUser, mustSetPassword: true }, accessToken: 't' })
    renderGate()
    expect(screen.queryByText('app shell')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/set-password')
  })

  it('renders the app for an unflagged user', () => {
    useAuthStore.setState({ user: { ...baseUser, mustSetPassword: false }, accessToken: 't' })
    renderGate()
    expect(screen.getByText('app shell')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('sends an unflagged user away from /set-password', () => {
    pathname = '/set-password'
    useAuthStore.setState({ user: baseUser, accessToken: 't' })
    renderGate()
    expect(screen.queryByText('app shell')).not.toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('lets the set-password page render for a flagged user', () => {
    pathname = '/set-password'
    useAuthStore.setState({ user: { ...baseUser, mustSetPassword: true }, accessToken: 't' })
    renderGate()
    expect(screen.getByText('app shell')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('does not navigate when signed out (session layer owns /login)', () => {
    renderGate()
    expect(screen.getByText('app shell')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('releases the user as soon as the flag clears', () => {
    pathname = '/set-password'
    useAuthStore.setState({ user: { ...baseUser, mustSetPassword: true }, accessToken: 't' })
    renderGate()
    expect(replace).not.toHaveBeenCalled()
    act(() => useAuthStore.getState().updateUser({ mustSetPassword: false }))
    expect(replace).toHaveBeenCalledWith('/')
  })
})
