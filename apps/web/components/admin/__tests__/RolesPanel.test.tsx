import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { RolesPanel } from '@/components/admin/RolesPanel'
import type { Role } from '@/lib/api/admin-types'

const rolesQuery = vi.hoisted(() => ({ data: undefined as Role[] | undefined, isLoading: true }))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/hooks/use-admin', () => ({
  useRoles: () => rolesQuery,
  useRoleActions: () => ({
    create: { mutate: vi.fn(), isPending: false },
    update: { mutate: vi.fn(), isPending: false },
  }),
}))

describe('RolesPanel', () => {
  beforeEach(() => {
    // jsdom has no matchMedia; the panel picks its desktop/mobile layout with it.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    rolesQuery.data = undefined
    rolesQuery.isLoading = true
  })

  // Regression: a fresh `[]` fallback on every render made the reseed check
  // fire forever ("Too many re-renders") while the roles query was loading.
  it('re-renders while roles are still loading without a render loop', () => {
    const { rerender } = render(<RolesPanel />)
    // The query re-renders the panel (fetch status changes) before data arrives.
    expect(() => rerender(<RolesPanel />)).not.toThrow()
  })

  it('shows the roles once they load', () => {
    rolesQuery.isLoading = false
    rolesQuery.data = [
      { _id: 'r-owner', name: 'Owner', isPreset: true, permissions: {} },
      { _id: 'r-member', name: 'Member', isPreset: true, permissions: {} },
    ]
    render(<RolesPanel />)
    expect(screen.getAllByText('Member').length).toBeGreaterThan(0)
  })
})
