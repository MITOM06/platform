import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ResponseStyleSection } from '@/components/ai/ResponseStyleSection'
import type { AiUserContext } from '@/lib/api/ai-context'

const mutate = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/lib/hooks/use-ai-context', () => ({
  useUpdateMyStyle: () => ({ mutate, isPending: false }),
}))

function ctx(overrides: Partial<AiUserContext> = {}): AiUserContext {
  return {
    userId: 'u1',
    jobTitle: '',
    projects: [],
    style: '',
    preferences: '',
    updatedBy: 'u1',
    ...overrides,
  }
}

describe('ResponseStyleSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves the edited style + preferences on Update', () => {
    render(<ResponseStyleSection context={ctx()} />)
    const style = screen.getByLabelText('styleLabel') as HTMLTextAreaElement
    fireEvent.change(style, { target: { value: 'concise' } })
    fireEvent.click(screen.getByText('update'))
    expect(mutate).toHaveBeenCalledWith({ style: 'concise', preferences: '' })
  })

  it('disables Update when nothing changed', () => {
    render(<ResponseStyleSection context={ctx({ style: 'x' })} />)
    expect((screen.getByText('update').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })
})
