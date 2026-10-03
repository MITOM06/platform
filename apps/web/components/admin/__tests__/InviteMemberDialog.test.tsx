import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { InviteMemberDialog } from '@/components/admin/InviteMemberDialog'
import type { Role } from '@/lib/api/admin-types'

const mutate = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'vi',
}))
vi.mock('@/lib/hooks/use-admin', () => ({
  useCreateInvitation: () => ({ mutate, isPending: false }),
}))
vi.mock('@/lib/hooks/use-capabilities', () => ({
  useCapabilities: () => ({ data: { role: 'Admin' } }),
}))

const roles: Role[] = [
  { _id: 'r-owner', name: 'Owner', isPreset: true, permissions: {} },
  { _id: 'r-member', name: 'Member', isPreset: true, permissions: {} },
  { _id: 'r-manager', name: 'Manager', isPreset: true, permissions: {} },
]

describe('InviteMemberDialog', () => {
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

  it('submits lowercased email, default Member role and the UI locale', () => {
    render(
      <InviteMemberDialog open onOpenChange={() => {}} canRoles canDepts={false} roles={roles} departments={[]} />,
    )
    fireEvent.change(screen.getByLabelText('inviteEmail'), { target: { value: ' Jane@Acme.com ' } })
    fireEvent.click(screen.getByText('inviteSubmit'))
    expect(mutate).toHaveBeenCalledWith(
      { email: 'jane@acme.com', roleId: 'r-member', departmentIds: undefined, locale: 'vi' },
      expect.anything(),
    )
  })

  it('omits roleId when the caller cannot read roles', () => {
    render(
      <InviteMemberDialog open onOpenChange={() => {}} canRoles={false} canDepts={false} roles={[]} departments={[]} />,
    )
    fireEvent.change(screen.getByLabelText('inviteEmail'), { target: { value: 'a@b.io' } })
    fireEvent.click(screen.getByText('inviteSubmit'))
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.io', roleId: undefined }),
      expect.anything(),
    )
  })

  it('rejects an invalid email without calling the API', () => {
    render(
      <InviteMemberDialog open onOpenChange={() => {}} canRoles={false} canDepts={false} roles={[]} departments={[]} />,
    )
    fireEvent.change(screen.getByLabelText('inviteEmail'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByText('inviteSubmit'))
    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText('emailInvalid')).toBeInTheDocument()
  })
})
