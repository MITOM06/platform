import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { RolesPanel } from '@/components/admin/RolesPanel'
import type { Role } from '@/lib/api/admin-types'

const state = vi.hoisted(() => ({
  caps: { role: 'Owner', perms: [] as string[] },
  remove: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values?.name ? `${key}:${values.name}` : key,
  useLocale: () => 'en',
}))
vi.mock('@/lib/hooks/use-capabilities', () => ({
  useCapabilities: () => ({ data: state.caps }),
}))

const roles: Role[] = [
  { _id: 'r-owner', name: 'Owner', isPreset: true, permissions: {} },
  { _id: 'r-admin', name: 'Admin', isPreset: true, permissions: { MANAGE_MEMBERS: true } },
  { _id: 'r-member', name: 'Member', isPreset: true, permissions: { USE_GROUP_BOT: true } },
  { _id: 'r-support', name: 'Support', isPreset: false, permissions: { USE_GROUP_BOT: true } },
  { _id: 'r-deputy', name: 'Deputy', isPreset: false, permissions: { MANAGE_WORKSPACE: true } },
]

vi.mock('@/lib/hooks/use-admin', () => ({
  useRoles: () => ({ data: roles, isLoading: false, isError: false }),
  useRoleActions: () => ({
    create: { mutate: vi.fn(), isPending: false },
    update: { mutate: vi.fn(), isPending: false },
    remove: { mutate: state.remove, isPending: false },
  }),
}))

/** Delete buttons of the desktop matrix, by role name (the mobile layout shows one role). */
function deleteButtonOf(roleName: string) {
  const header = screen.getAllByRole('columnheader').find((th) => th.textContent?.startsWith(roleName))
  if (!header) throw new Error(`no column for ${roleName}`)
  return within(header).queryByRole('button', { name: 'roleDelete' })
}

describe('RolesPanel — delete a custom role', () => {
  beforeEach(() => {
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
    state.caps = { role: 'Owner', perms: [] }
    state.remove.mockReset()
  })

  it('offers Delete on custom roles only, never on a preset', () => {
    render(<RolesPanel />)
    expect(deleteButtonOf('Owner')).toBeNull()
    expect(deleteButtonOf('Admin')).toBeNull()
    expect(deleteButtonOf('Member')).toBeNull()
    expect(deleteButtonOf('Support')).toBeEnabled()
    expect(deleteButtonOf('Deputy')).toBeEnabled()
  })

  it('asks for confirmation, then deletes that role', () => {
    render(<RolesPanel />)
    fireEvent.click(deleteButtonOf('Support')!)
    expect(screen.getByText('roleDeleteTitle:Support')).toBeInTheDocument()
    expect(state.remove).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'roleDelete' }))
    expect(state.remove).toHaveBeenCalledWith('r-support', expect.anything())
  })

  it('cancelling the confirmation deletes nothing', () => {
    render(<RolesPanel />)
    fireEvent.click(deleteButtonOf('Support')!)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'cancel' }))
    expect(state.remove).not.toHaveBeenCalled()
  })

  it('a non-Owner cannot delete the role they hold, nor a role above their own capabilities', () => {
    state.caps = { role: 'Support', perms: ['USE_GROUP_BOT', 'MANAGE_ROLES'] }
    render(<RolesPanel />)
    // Own role (CANNOT_EDIT_OWN_ROLE) and a role with MANAGE_WORKSPACE they lack.
    expect(deleteButtonOf('Support')).toBeDisabled()
    expect(deleteButtonOf('Deputy')).toBeDisabled()
  })
})
