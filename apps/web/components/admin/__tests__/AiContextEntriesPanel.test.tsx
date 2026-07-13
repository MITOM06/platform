import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AiContextEntriesPanel } from '@/components/admin/AiContextEntriesPanel'

const createMutate = vi.fn()

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/hooks/use-admin', () => ({ useDepartments: () => ({ data: [] }) }))
vi.mock('@/lib/hooks/use-capabilities', () => ({ useHasCapability: () => true }))
vi.mock('@/lib/hooks/use-ai-context', () => ({
  useContextEntries: () => ({ data: [], isLoading: false }),
  useCreateEntry: () => ({ mutate: createMutate, isPending: false }),
  useUpdateEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteEntry: () => ({ mutate: vi.fn(), isPending: false }),
}))

describe('AiContextEntriesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
  })

  it('creates a company entry with the chosen tier → requiredCapability', () => {
    render(<AiContextEntriesPanel />)
    fireEvent.click(screen.getByText('createEntry'))
    fireEvent.change(screen.getByLabelText('entryLabel'), { target: { value: 'Mission' } })
    fireEvent.change(screen.getByLabelText('entryText'), { target: { value: 'Build.' } })
    fireEvent.click(screen.getByText('save'))
    expect(createMutate).toHaveBeenCalledWith(
      { scope: 'company', scopeId: null, label: 'Mission', text: 'Build.', requiredCapability: null },
      expect.anything(),
    )
  })
})
