import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

import { CallConnectionNotice } from '../CallConnectionNotice'
import { CallReconnectOverlay } from '../CallReconnectOverlay'
import { useCallStore } from '@/lib/store/call.store'

beforeEach(() => {
  vi.useFakeTimers()
  useCallStore.getState().reset()
  useCallStore.getState().setPeerName('Bob')
})
afterEach(() => vi.useRealTimers())

describe('CallConnectionNotice', () => {
  it('says whose network is weak', () => {
    const { rerender } = render(<CallConnectionNotice />)
    expect(screen.queryByRole('status')).toBeNull()

    act(() => useCallStore.getState().setPoorConnection(true))
    rerender(<CallConnectionNotice />)
    expect(screen.getByRole('status').textContent).toBe('selfWeakNetwork')

    act(() => {
      useCallStore.getState().setPoorConnection(false)
      useCallStore.getState().setPeerPoor(true)
    })
    rerender(<CallConnectionNotice />)
    expect(screen.getByRole('status').textContent).toBe('peerWeakNetwork:{"name":"Bob"}')

    act(() => useCallStore.getState().setPoorConnection(true))
    rerender(<CallConnectionNotice />)
    expect(screen.getByRole('status').textContent).toBe('unstableNetwork')
  })
})

describe('CallReconnectOverlay', () => {
  it('waits for the other person with a countdown', () => {
    act(() => useCallStore.getState().setReconnectWait('peer', Date.now() + 60_000))
    render(<CallReconnectOverlay />)
    expect(screen.getByText('waitingForPeer:{"name":"Bob"}')).toBeTruthy()
    expect(screen.getByText('reconnectCountdown:{"seconds":60}')).toBeTruthy()
    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.getByText('reconnectCountdown:{"seconds":45}')).toBeTruthy()
  })

  it('says it is our own connection that is reconnecting', () => {
    act(() => useCallStore.getState().setReconnectWait('self', Date.now() + 60_000))
    render(<CallReconnectOverlay />)
    expect(screen.getByText('reconnectingSelf')).toBeTruthy()
  })

  it('shows nothing while connected', () => {
    const { container } = render(<CallReconnectOverlay />)
    expect(container.textContent).toBe('')
  })
})
