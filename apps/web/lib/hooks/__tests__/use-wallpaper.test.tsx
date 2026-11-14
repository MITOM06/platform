import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const h = vi.hoisted(() => ({ conv: { data: undefined as { wallpaper?: string } | undefined } }))
vi.mock('@/lib/hooks/use-conversation', () => ({ useConversation: () => h.conv }))
vi.mock('@/lib/media', () => ({ absoluteMediaUrl: (u: string) => `ABS(${u})` }))

import { useWallpaper, WALLPAPER_EVENT } from '@/lib/hooks/use-wallpaper'
import { THEME_CATEGORIES } from '@/components/chat/wallpaper-presets'

const fire = (conversationId: string, value: string) =>
  act(() => { window.dispatchEvent(new CustomEvent(WALLPAPER_EVENT, { detail: { conversationId, value } })) })

beforeEach(() => { h.conv = { data: undefined } })

describe('useWallpaper resolution', () => {
  const resolve = (wallpaper?: string) => {
    h.conv = { data: { wallpaper } }
    return renderHook(() => useWallpaper('c1')).result.current
  }

  it('default / empty / missing → background class', () => {
    expect(resolve(undefined)).toEqual({ className: 'bg-background', isImage: false })
    expect(resolve('')).toEqual({ className: 'bg-background', isImage: false })
    expect(resolve('default')).toEqual({ className: 'bg-background', isImage: false })
  })

  it('preset: ids map through aliases; unknown preset → default', () => {
    expect(resolve('preset:midnight_glow').className).toContain('from-indigo-900/45')
    expect(resolve('preset:pure_dark').className).toBe('bg-[#050507] dark:bg-[#030303]')
    expect(resolve('preset:nope')).toEqual({ className: 'bg-background', isImage: false })
  })

  it('every preset offered by the picker resolves to its own class', () => {
    for (const item of THEME_CATEGORIES.flatMap((c) => c.items)) {
      const r = resolve(item.value)
      expect(r.isImage).toBe(false)
      expect(r.className).not.toBe('bg-background')
    }
  })

  it('legacy flat keys resolve as presets, not URLs', () => {
    const r = resolve('sunset')
    expect(r.isImage).toBe(false)
    expect(r.className).toContain('from-orange-400/30')
  })

  it('image URLs default to cover', () => {
    expect(resolve('https://x/a.jpg')).toEqual({
      style: { backgroundImage: 'url(ABS(https://x/a.jpg))', backgroundSize: 'cover', backgroundPosition: 'center' },
      isImage: true,
    })
  })

  it('fit=fill / contain / custom scale', () => {
    expect(resolve('/m/a.jpg#fit=fill').style?.backgroundSize).toBe('100% 100%')
    expect(resolve('/m/a.jpg#fit=contain').style?.backgroundSize).toBe('contain')
    expect(resolve('/m/a.jpg#fit=cover&scale=150').style?.backgroundSize).toBe('150%')
    expect(resolve('/m/a.jpg#fit=cover&scale=-3').style?.backgroundSize).toBe('cover')
    expect(resolve('/m/a.jpg#fit=cover').style?.backgroundImage).toBe('url(ABS(/m/a.jpg))')
  })
})

describe('useWallpaper optimistic override', () => {
  it('applies a matching event, ignores other conversations, clears when the server catches up', () => {
    h.conv = { data: { wallpaper: 'default' } }
    const { result, rerender } = renderHook(() => useWallpaper('c1'))
    fire('other', 'preset:storm')
    expect(result.current.className).toBe('bg-background')
    fire('c1', 'preset:storm')
    expect(result.current.className).toContain('from-slate-700/45')
    fire('c1', '')
    expect(result.current.className).toBe('bg-background')
    fire('c1', 'preset:candy')
    h.conv = { data: { wallpaper: 'preset:galaxy' } }
    rerender()
    expect(result.current.className).toContain('from-indigo-900/65')
  })

  it('removes the listener on unmount', () => {
    const spy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useWallpaper('c1'))
    unmount()
    expect(spy).toHaveBeenCalledWith(WALLPAPER_EVENT, expect.any(Function))
    spy.mockRestore()
  })
})
