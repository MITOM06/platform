/**
 * OAuth connect popup: poll until the backend redirects back with
 * `?connected=` / `?error=`, ignore the cross-origin phase, fall back to a
 * same-tab redirect when blocked. The outcome toast names the connector, never
 * the slug, and maps the error code to a localized reason.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const h = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  sources: { catalog: [{ id: 'gmail', name: 'Gmail' }] } as Record<string, unknown>,
  t: (k: string, v?: Record<string, unknown>) => (v ? `${k}(${JSON.stringify(v)})` : k),
}))
vi.mock('next-intl', () => ({ useTranslations: () => h.t }))
vi.mock('sonner', () => ({ toast: { success: h.toastSuccess, error: h.toastError } }))
vi.mock('@/lib/hooks/use-connectors', () => ({ useProviderNameSources: () => h.sources }))

import { useOAuthPopup, useOAuthReturnNotice } from '@/lib/hooks/use-oauth-popup'
import { oauthCallbackErrorKey } from '@/lib/integrations/connector-errors'

interface FakePopup {
  closed: boolean
  close: ReturnType<typeof vi.fn>
  location: { search: string } | null
}

let popup: FakePopup
let openSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  popup = { closed: false, close: vi.fn(), location: { search: '' } }
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => popup as unknown as Window)
})

afterEach(() => {
  openSpy.mockRestore()
  vi.useRealTimers()
})

describe('useOAuthPopup', () => {
  it('reports ?connected and closes the popup', () => {
    const done = vi.fn()
    const { result } = renderHook(() => useOAuthPopup(done))
    act(() => result.current.open('https://accounts.example/authorize', 'gmail'))
    expect(openSpy).toHaveBeenCalledWith('https://accounts.example/authorize', 'pon-oauth', expect.any(String))
    expect(result.current.connectingId).toBe('gmail')

    act(() => vi.advanceTimersByTime(600))
    expect(done).not.toHaveBeenCalled() // nothing in the query yet

    popup.location = { search: '?connected=gmail' }
    act(() => vi.advanceTimersByTime(600))
    expect(popup.close).toHaveBeenCalled()
    expect(done).toHaveBeenCalledWith({ connected: 'gmail' })
    expect(result.current.connectingId).toBeNull()

    // Polling stopped.
    act(() => vi.advanceTimersByTime(3000))
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('ignores the cross-origin phase (reading location throws) until the redirect', () => {
    const done = vi.fn()
    const { result } = renderHook(() => useOAuthPopup(done))
    act(() => result.current.open('https://x', 'gmail'))
    Object.defineProperty(popup, 'location', {
      configurable: true,
      get() {
        throw new DOMException('Blocked a frame with origin', 'SecurityError')
      },
    })
    act(() => vi.advanceTimersByTime(1800))
    expect(done).not.toHaveBeenCalled()
    expect(result.current.connectingId).toBe('gmail')

    Object.defineProperty(popup, 'location', { configurable: true, value: { search: '?error=ACCESS_DENIED&provider=gmail' } })
    act(() => vi.advanceTimersByTime(600))
    expect(done).toHaveBeenCalledWith({ error: 'ACCESS_DENIED', provider: 'gmail' })
  })

  it('a popup closed by the user reports null', () => {
    const done = vi.fn()
    const { result } = renderHook(() => useOAuthPopup(done))
    act(() => result.current.open('https://x', 'gmail'))
    popup.closed = true
    act(() => vi.advanceTimersByTime(600))
    expect(done).toHaveBeenCalledWith(null)
    expect(result.current.connectingId).toBeNull()
  })

  it('a blocked popup falls back to a same-tab redirect', () => {
    openSpy.mockReturnValue(null)
    const assign = vi.fn()
    const origLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...origLocation, set href(v: string) { assign(v) } },
    })
    const done = vi.fn()
    const { result } = renderHook(() => useOAuthPopup(done))
    act(() => result.current.open('https://accounts.example/authorize', 'gmail'))
    expect(assign).toHaveBeenCalledWith('https://accounts.example/authorize')
    expect(done).not.toHaveBeenCalled()
    Object.defineProperty(window, 'location', { configurable: true, value: origLocation })
  })

  it('opening again replaces the previous poll; unmount stops polling; reset clears the spinner', () => {
    const done = vi.fn()
    const { result, unmount } = renderHook(() => useOAuthPopup(done))
    act(() => result.current.open('https://x', 'a'))
    act(() => result.current.open('https://x', 'b'))
    expect(result.current.connectingId).toBe('b')
    act(() => result.current.reset())
    expect(result.current.connectingId).toBeNull()
    unmount()
    popup.closed = true
    vi.advanceTimersByTime(5000)
    expect(done).not.toHaveBeenCalled()
  })
})

describe('useOAuthReturnNotice', () => {
  it('names a known connector on success; generic text for an unknown slug', () => {
    const { result } = renderHook(() => useOAuthReturnNotice())
    result.current({ connected: 'gmail' })
    expect(h.toastSuccess).toHaveBeenLastCalledWith('connectSuccess({"provider":"Gmail"})')
    result.current({ connected: 'mystery-tool' })
    expect(h.toastSuccess).toHaveBeenLastCalledWith('connectSuccessGeneric')
  })

  it('maps the error code to a localized reason, named when the provider is known', () => {
    const { result } = renderHook(() => useOAuthReturnNotice())
    const reason = oauthCallbackErrorKey('ACCESS_DENIED')
    result.current({ error: 'ACCESS_DENIED', provider: 'gmail' })
    expect(h.toastError).toHaveBeenLastCalledWith(
      `connectFailedNamed(${JSON.stringify({ provider: 'Gmail', reason })})`,
    )
    result.current({ error: 'ACCESS_DENIED' })
    expect(h.toastError).toHaveBeenLastCalledWith(reason)
  })

  it('an empty result shows nothing', () => {
    const { result } = renderHook(() => useOAuthReturnNotice())
    result.current({} as never)
    expect(h.toastSuccess).not.toHaveBeenCalled()
    expect(h.toastError).not.toHaveBeenCalled()
  })
})
