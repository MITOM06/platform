import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { SsoButton, ssoLoginHref } from '@/components/auth/SsoSignIn'
import { clearSsoReauth, markSsoReauth } from '@/lib/auth/sso-reauth'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}))

const href = () => screen.getByTestId('sso-button').getAttribute('href')

describe('SsoButton link', () => {
  beforeEach(() => localStorage.clear())

  it('ssoLoginHref only adds the flag when asked', () => {
    expect(ssoLoginHref()).toMatch(/\/auth\/oidc\/login\?platform=web$/)
    expect(ssoLoginHref(false)).toMatch(/\/auth\/oidc\/login\?platform=web$/)
    expect(ssoLoginHref(true)).toMatch(/\/auth\/oidc\/login\?platform=web&reauth=1$/)
  })

  it('stays a plain link when nobody signed out here (silent SSO keeps working)', () => {
    render(<SsoButton />)
    expect(href()).toMatch(/\?platform=web$/)
  })

  it('asks for re-authentication after a sign-out on this device', () => {
    markSsoReauth()
    render(<SsoButton />)
    expect(href()).toMatch(/\?platform=web&reauth=1$/)
  })

  it('the emphasised button (Require SSO, invite card) behaves the same', () => {
    markSsoReauth()
    render(<SsoButton emphasised />)
    expect(href()).toMatch(/&reauth=1$/)
  })

  it('a login page left open in another tab follows that tab signing out, then in', () => {
    render(<SsoButton />)

    act(() => {
      markSsoReauth()
      window.dispatchEvent(new StorageEvent('storage', { key: 'pon-sso-reauth' }))
    })
    expect(href()).toMatch(/&reauth=1$/)

    act(() => {
      clearSsoReauth()
      window.dispatchEvent(new StorageEvent('storage', { key: 'pon-sso-reauth' }))
    })
    expect(href()).toMatch(/\?platform=web$/)
  })

  // React does not repair an attribute that differs after server rendering: read
  // naively, the href would stay the server's plain one and silently sign in.
  it('hydrates without a mismatch and then carries the flag', async () => {
    markSsoReauth()
    const html = renderToString(<SsoButton />)
    expect(html).not.toContain('reauth')

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    const onRecoverableError = vi.fn()
    const root = await act(async () => hydrateRoot(container, <SsoButton />, { onRecoverableError }))

    expect(container.querySelector('a')?.getAttribute('href')).toMatch(/&reauth=1$/)
    expect(onRecoverableError).not.toHaveBeenCalled()
    act(() => root.unmount())
    container.remove()
  })
})
