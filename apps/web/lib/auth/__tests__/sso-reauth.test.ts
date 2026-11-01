import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clearSsoReauth, isSsoReauthDue, markSsoReauth, subscribeSsoReauth } from '@/lib/auth/sso-reauth'

describe('sso-reauth flag', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('is off by default, on after a sign-out, off again after an SSO sign-in', () => {
    expect(isSsoReauthDue()).toBe(false)
    markSsoReauth()
    expect(isSsoReauthDue()).toBe(true)
    clearSsoReauth()
    expect(isSsoReauthDue()).toBe(false)
  })

  it('lives in localStorage, so closing the tab does not lose it', () => {
    markSsoReauth()
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(1)
  })

  it('stores nothing about the person', () => {
    markSsoReauth()
    expect(Object.values({ ...localStorage })).toEqual(['1'])
  })

  it('a blocked storage never breaks sign-out or the SSO button', () => {
    const blocked = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)

    expect(() => markSsoReauth()).not.toThrow()
    expect(() => clearSsoReauth()).not.toThrow()
    expect(isSsoReauthDue()).toBe(false)
  })

  it('follows changes from other tabs, until unsubscribed', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeSsoReauth(onChange)

    window.dispatchEvent(new StorageEvent('storage', { key: 'pon-sso-reauth' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    // localStorage.clear() in another tab.
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(onChange).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new StorageEvent('storage', { key: 'pon-sidebar-width' }))
    expect(onChange).toHaveBeenCalledTimes(2)

    unsubscribe()
    window.dispatchEvent(new StorageEvent('storage', { key: 'pon-sso-reauth' }))
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
