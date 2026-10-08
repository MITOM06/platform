import { describe, it, expect } from 'vitest'
import { isMacPlatform, matchShortcut, shortcutLabel } from '@/lib/meetings/shortcuts'

const key = (code: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) =>
  ({ code, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods })

describe('matchShortcut', () => {
  it('uses Ctrl on Windows/Linux and ⌘ on macOS, like Meet', () => {
    expect(matchShortcut(key('KeyD', { ctrlKey: true }), false)).toBe('toggleMic')
    expect(matchShortcut(key('KeyE', { ctrlKey: true }), false)).toBe('toggleCamera')
    expect(matchShortcut(key('KeyH', { ctrlKey: true, altKey: true }), false)).toBe('toggleHand')
    expect(matchShortcut(key('KeyD', { metaKey: true }), true)).toBe('toggleMic')
    expect(matchShortcut(key('KeyH', { metaKey: true, altKey: true }), true)).toBe('toggleHand')
  })

  it('ignores other combos, repeats and IME composition', () => {
    expect(matchShortcut(key('KeyD', { metaKey: true }), false)).toBeNull()
    expect(matchShortcut(key('KeyD', { ctrlKey: true, shiftKey: true }), false)).toBeNull()
    expect(matchShortcut(key('KeyD', { ctrlKey: true, altKey: true }), false)).toBeNull()
    expect(matchShortcut(key('KeyH', { ctrlKey: true }), false)).toBeNull()
    expect(matchShortcut({ ...key('KeyD', { ctrlKey: true }), repeat: true }, false)).toBeNull()
    expect(matchShortcut({ ...key('KeyD', { ctrlKey: true }), isComposing: true }, false)).toBeNull()
  })

  it('labels shortcuts per platform', () => {
    expect(shortcutLabel('toggleMic', true)).toBe('⌘D')
    expect(shortcutLabel('toggleHand', false)).toBe('Ctrl+Alt+H')
    expect(isMacPlatform({ platform: 'MacIntel' })).toBe(true)
    expect(isMacPlatform({ platform: 'Win32', userAgent: 'Windows' })).toBe(false)
  })
})
