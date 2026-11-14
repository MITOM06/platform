import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const h = vi.hoisted(() => {
  const toast = vi.fn()
  return {
    toast,
    cookieSet: vi.fn(),
    stomp: { connected: false, listener: null as null | ((c: boolean) => void), unsub: vi.fn() },
  }
})
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('next/headers', () => ({ cookies: async () => ({ set: h.cookieSet }) }))
vi.mock('@/lib/stomp/client', () => ({
  stompService: {
    isConnected: () => h.stomp.connected,
    onStateChange: (fn: (c: boolean) => void) => { h.stomp.listener = fn; return h.stomp.unsub },
  },
}))

import { presentNotice } from '@/lib/realtime/present-notice'
import { setLocaleAction } from '@/lib/actions/locale'
import { cn, getInitials } from '@/lib/utils'
import { fmtTokens } from '@/lib/usage/format'
import { useStompConnected } from '@/lib/stomp/use-stomp-connected'

beforeEach(() => { h.toast.mockReset(); h.cookieSet.mockReset(); h.stomp.unsub.mockReset() })

describe('presentNotice', () => {
  const origVis = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  afterEach(() => {
    vi.unstubAllGlobals()
    if (origVis) Object.defineProperty(document, 'visibilityState', origVis)
    else delete (document as unknown as Record<string, unknown>).visibilityState
  })

  class FakeNotification {
    static permission = 'granted'
    static last: FakeNotification | null = null
    onclick: (() => void) | null = null
    constructor(public title: string, public opts: { body: string }) { FakeNotification.last = this }
  }

  it('hidden tab + permission → OS notification that focuses and opens on click', () => {
    vi.stubGlobal('Notification', FakeNotification)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    const open = vi.fn()
    presentNotice('T', 'B', open, 'Open')
    expect(FakeNotification.last).toMatchObject({ title: 'T', opts: { body: 'B' } })
    expect(h.toast).not.toHaveBeenCalled()
    FakeNotification.last!.onclick!()
    expect(focus).toHaveBeenCalled()
    expect(open).toHaveBeenCalled()
  })

  it('visible tab (or no permission) → toast with an Open action', () => {
    vi.stubGlobal('Notification', FakeNotification)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    const open = vi.fn()
    presentNotice('T', 'B', open, 'Open')
    expect(h.toast).toHaveBeenCalledWith('T', { description: 'B', action: { label: 'Open', onClick: open } })
    FakeNotification.permission = 'denied'
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    presentNotice('T2', 'B2', open, 'Go')
    expect(h.toast).toHaveBeenCalledTimes(2)
    FakeNotification.permission = 'granted'
  })
})

describe('setLocaleAction', () => {
  it('stores a supported locale for a year', async () => {
    await setLocaleAction('vi')
    expect(h.cookieSet).toHaveBeenCalledWith('locale', 'vi', { path: '/', maxAge: 31536000, sameSite: 'lax', httpOnly: false })
  })
  it('ignores an unsupported locale', async () => {
    await setLocaleAction('xx' as never)
    expect(h.cookieSet).not.toHaveBeenCalled()
  })
})

describe('utils', () => {
  it('cn merges and dedupes tailwind classes', () => {
    expect(cn('p-2', false && 'hidden', 'p-4', ['text-sm'])).toBe('p-4 text-sm')
  })
  it('getInitials', () => {
    expect(getInitials('nguyen van a')).toBe('NV')
    expect(getInitials('')).toBe('')
  })
  it('fmtTokens', () => {
    expect(fmtTokens(512)).toBe('512')
    expect(fmtTokens(1500)).toBe('1.5K')
    expect(fmtTokens(2_340_000)).toBe('2.3M')
  })
})

describe('useStompConnected', () => {
  it('starts from the current state, follows changes and unsubscribes', () => {
    h.stomp.connected = true
    const { result, unmount } = renderHook(() => useStompConnected())
    expect(result.current).toBe(true)
    act(() => h.stomp.listener!(false))
    expect(result.current).toBe(false)
    unmount()
    expect(h.stomp.unsub).toHaveBeenCalled()
  })
})
