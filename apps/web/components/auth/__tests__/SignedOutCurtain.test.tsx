import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { SignedOutCurtain } from '@/components/auth/SignedOutCurtain'
import { useAuthStore } from '@/lib/store/auth.store'

const alice = { id: 'u1', email: 'alice@acme.com', displayName: 'Alice' }

function pageShow(persisted: boolean): Event {
  return Object.assign(new Event('pageshow'), { persisted })
}

describe('SignedOutCurtain', () => {
  const realLocation = window.location
  let replace: ReturnType<typeof vi.fn>

  beforeEach(() => {
    replace = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { replace } })
    useAuthStore.setState({ user: alice, accessToken: 'tok' })
  })
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  })

  const curtain = () => screen.queryByTestId('signed-out-curtain')

  it('stays out of the way while signed in', () => {
    render(<SignedOutCurtain />)
    expect(curtain()).toBeNull()
  })

  it('covers the app the moment the session is cleared, before the page is left', () => {
    render(<SignedOutCurtain />)
    act(() => useAuthStore.getState().clearAuth())
    expect(curtain()).not.toBeNull()
  })

  it('sends a page restored from the back/forward cache after a sign-out to /login', () => {
    render(<SignedOutCurtain />)
    act(() => useAuthStore.getState().clearAuth())
    window.dispatchEvent(pageShow(true))
    expect(replace).toHaveBeenCalledWith('/login')
  })

  it('leaves a restored page alone while still signed in, and ignores a normal load', () => {
    render(<SignedOutCurtain />)
    window.dispatchEvent(pageShow(true))
    act(() => useAuthStore.getState().clearAuth())
    window.dispatchEvent(pageShow(false))
    expect(replace).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    const { unmount } = render(<SignedOutCurtain />)
    unmount()
    useAuthStore.getState().clearAuth()
    window.dispatchEvent(pageShow(true))
    expect(replace).not.toHaveBeenCalled()
  })
})
