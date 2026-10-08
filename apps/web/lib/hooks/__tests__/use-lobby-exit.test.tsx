import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLobbyExit } from '@/lib/hooks/use-lobby-exit'

function pageEvent(type: 'pagehide' | 'pageshow', persisted: boolean): Event {
  return Object.assign(new Event(type), { persisted })
}

describe('useLobbyExit', () => {
  it('drops the lobby entry on pagehide while waiting and re-asks when restored from the bfcache', () => {
    const room = { leaveLobbyOnExit: vi.fn(), onRealtimeReconnected: vi.fn(async () => undefined) }
    const hook = renderHook((p: { waiting: boolean }) => useLobbyExit(room, p.waiting), { initialProps: { waiting: true } })

    window.dispatchEvent(pageEvent('pagehide', false))
    expect(room.leaveLobbyOnExit).toHaveBeenCalledTimes(1)
    window.dispatchEvent(pageEvent('pageshow', false))
    expect(room.onRealtimeReconnected).not.toHaveBeenCalled()
    window.dispatchEvent(pageEvent('pageshow', true))
    expect(room.onRealtimeReconnected).toHaveBeenCalledTimes(1)

    hook.rerender({ waiting: false })
    window.dispatchEvent(pageEvent('pagehide', false))
    expect(room.leaveLobbyOnExit).toHaveBeenCalledTimes(1)
  })
})
