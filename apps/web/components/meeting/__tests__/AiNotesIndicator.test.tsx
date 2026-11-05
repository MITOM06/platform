import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const toastInfo = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { info: toastInfo }) }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { AiNotesIndicator } from '@/components/meeting/room/AiNotesIndicator'

beforeEach(() => toastInfo.mockClear())

describe('AiNotesIndicator', () => {
  it('indicator shows while aiNotes is on', () => {
    render(<AiNotesIndicator active />)
    expect(screen.getByText('aiNotesActive')).toBeTruthy()
  })

  it('chip is a status live region', () => {
    render(<AiNotesIndicator active />)
    expect(screen.getByRole('status').textContent).toContain('aiNotesActive')
  })

  it('shows nothing while aiNotes is off', () => {
    render(<AiNotesIndicator active={false} />)
    expect(screen.queryByText('aiNotesActive')).toBeNull()
  })

  it('banner shows once when aiNotes flips on mid-meeting', () => {
    const { rerender } = render(<AiNotesIndicator active={false} />)
    expect(toastInfo).not.toHaveBeenCalled()
    rerender(<AiNotesIndicator active />)
    expect(toastInfo).toHaveBeenCalledTimes(1)
    expect(toastInfo).toHaveBeenCalledWith('aiNotesStarted')
    rerender(<AiNotesIndicator active />)
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })

  it('no banner when the room opens with aiNotes already on', () => {
    render(<AiNotesIndicator active />)
    expect(toastInfo).not.toHaveBeenCalled()
  })
})
