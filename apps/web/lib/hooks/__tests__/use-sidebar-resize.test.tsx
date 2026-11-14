import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type React from 'react'
import { useSidebarResize } from '@/lib/hooks/use-sidebar-resize'
import { useUiStore, SIDEBAR_MIN_WIDTH } from '@/lib/store/ui.store'

const initial = useUiStore.getState()
beforeEach(() => {
  useUiStore.setState(initial, true)
  localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
})

const down = (clientX: number) => ({ clientX, preventDefault: vi.fn() }) as unknown as React.MouseEvent
const move = (clientX: number) => act(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX })) })
const up = () => act(() => { window.dispatchEvent(new MouseEvent('mouseup')) })

describe('useSidebarResize', () => {
  it('restores a valid persisted width', () => {
    localStorage.setItem('pon-sidebar-width', '400')
    const { result } = renderHook(() => useSidebarResize())
    expect(result.current.sidebarWidth).toBe(400)
  })

  it.each(['abc', String(SIDEBAR_MIN_WIDTH - 1), '900'])('ignores invalid stored width %s', (v) => {
    localStorage.setItem('pon-sidebar-width', v)
    const { result } = renderHook(() => useSidebarResize())
    expect(result.current.sidebarWidth).toBe(initial.sidebarWidth)
  })

  it('drags within [min, 80% viewport] and persists only on release', () => {
    const { result } = renderHook(() => useSidebarResize())
    act(() => useUiStore.getState().setSidebarWidth(300, false))
    const e = down(300)
    act(() => result.current.handleDragStart(e))
    expect(e.preventDefault).toHaveBeenCalled()
    move(350)
    expect(useUiStore.getState().sidebarWidth).toBe(350)
    expect(localStorage.getItem('pon-sidebar-width')).toBeNull()
    move(0)
    expect(useUiStore.getState().sidebarWidth).toBe(SIDEBAR_MIN_WIDTH)
    move(5000)
    expect(useUiStore.getState().sidebarWidth).toBe(800)
    up()
    expect(localStorage.getItem('pon-sidebar-width')).toBe('800')
    move(400)
    expect(useUiStore.getState().sidebarWidth).toBe(800)
  })
})
