import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { showCallNotification } from '../call-notification'

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

describe('showCallNotification', () => {
  it('raises a notification while the tab is hidden and returns a closer', () => {
    const close = vi.fn()
    const ctor = vi.fn(function (this: { close: () => void; onclick: unknown }) {
      this.close = close
      this.onclick = null
    })
    vi.stubGlobal('Notification', Object.assign(ctor, { permission: 'granted' }))
    const closer = showCallNotification('Incoming call', 'Alice')
    expect(ctor).toHaveBeenCalledWith('Incoming call', expect.objectContaining({ body: 'Alice' }))
    closer?.()
    expect(close).toHaveBeenCalled()
  })

  it('does nothing while the tab is visible', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    const ctor = vi.fn()
    vi.stubGlobal('Notification', Object.assign(ctor, { permission: 'granted' }))
    expect(showCallNotification('t', 'b')).toBeNull()
    expect(ctor).not.toHaveBeenCalled()
  })

  it('survives browsers whose page Notification constructor throws (Android Chrome)', () => {
    const ctor = vi.fn(() => {
      throw new TypeError('Illegal constructor')
    })
    vi.stubGlobal('Notification', Object.assign(ctor, { permission: 'granted' }))
    expect(() => showCallNotification('t', 'b')).not.toThrow()
    expect(showCallNotification('t', 'b')).toBeNull()
  })
})
