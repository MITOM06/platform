import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { MembersPanel } from '@/components/admin/MembersPanel'
import { useAuthStore } from '@/lib/store/auth.store'
import type { Member, Role } from '@/lib/api/admin-types'

const roles: Role[] = [
  { _id: 'r-owner', name: 'Owner', isPreset: true, permissions: {} },
  { _id: 'r-member', name: 'Member', isPreset: true, permissions: {} },
  { _id: 'r-admin', name: 'Admin', isPreset: true, permissions: {} },
]

const members: Member[] = [
  // The signed-in user's own row has 2FA on — still never resettable by themselves.
  { _id: 'me', displayName: 'Admin Me', email: 'me@x.io', status: 'active', roleId: 'r-member', mfaEnabled: true },
  { _id: 'bob', displayName: 'Bob', email: 'bob@x.io', status: 'active', roleId: 'r-member' },
  { _id: 'eve', displayName: 'Eve', email: 'eve@x.io', status: 'blocked' },
  { _id: 'olga', displayName: 'Olga', email: 'olga@x.io', status: 'active', roleId: 'r-owner' },
  { _id: 'ada', displayName: 'Ada', email: 'ada@x.io', status: 'active', roleId: 'r-admin', mfaEnabled: true },
]

const caps = vi.hoisted(() => ({ role: 'Admin' }))
const updateMutate = vi.hoisted(() => vi.fn())
const resetMfaMutate = vi.hoisted(() => vi.fn())

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/hooks/use-admin', () => ({
  useMembers: () => ({ data: members, isLoading: false }),
  useRoles: () => ({ data: roles }),
  useDepartments: () => ({ data: [] }),
  useUpdateMember: () => ({ mutate: updateMutate, isPending: false }),
  useSetMemberStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useResetMemberMfa: () => ({ mutate: resetMfaMutate, isPending: false }),
}))
vi.mock('@/lib/hooks/use-capabilities', () => ({
  useHasCapability: () => true,
  useCapabilities: () => ({ data: { role: caps.role } }),
}))
vi.mock('@/components/admin/EditMemberAiContextModal', () => ({ EditMemberAiContextModal: () => null }))
vi.mock('@/components/admin/InviteMemberDialog', () => ({ InviteMemberDialog: () => null }))
vi.mock('@/components/admin/PendingInvitationsList', () => ({ PendingInvitationsList: () => null }))

/** Open the edit modal of the n-th row (the pencil is the row's last button). */
function openEdit(rowIndex: number) {
  const row = screen.getAllByTestId('member-row')[rowIndex]
  const buttons = within(row).getAllByRole('button')
  fireEvent.click(buttons[buttons.length - 1])
}

describe('MembersPanel', () => {
  beforeEach(() => {
    caps.role = 'Admin'
    updateMutate.mockReset()
    resetMfaMutate.mockReset()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia
    useAuthStore.setState({ user: { id: 'me', email: 'me@x.io', displayName: 'Admin Me' }, accessToken: 't' })
  })

  it('hides the block action on the signed-in admin own row', () => {
    render(<MembersPanel />)
    const rows = screen.getAllByTestId('member-row')
    expect(within(rows[0]).queryByLabelText('memberBlock')).toBeNull()
    expect(within(rows[1]).getByLabelText('memberBlock')).toBeInTheDocument()
  })

  it('shows the blocked badge and an unblock action for blocked members', () => {
    render(<MembersPanel />)
    const eve = screen.getAllByTestId('member-row')[2]
    expect(within(eve).getByText('memberStatusBlocked')).toBeInTheDocument()
    expect(within(eve).getByLabelText('memberUnblock')).toBeInTheDocument()
  })

  it('offers the invite button to member managers', () => {
    render(<MembersPanel />)
    expect(screen.getByText('inviteMember')).toBeInTheDocument()
  })

  it('locks the role picker on your own row and never sends a role for it', () => {
    render(<MembersPanel />)
    openEdit(0)
    expect(screen.getByTestId('member-role-select')).toBeDisabled()
    expect(screen.getByTestId('member-role-locked')).toHaveTextContent('memberRoleLockedSelf')
    fireEvent.click(screen.getByText('save'))
    expect(updateMutate).toHaveBeenCalledWith(
      { id: 'me', input: { roleId: undefined, departmentIds: [] } },
      expect.anything(),
    )
  })

  it("locks an Owner's role for a non-Owner caller", () => {
    render(<MembersPanel />)
    openEdit(3)
    expect(screen.getByTestId('member-role-select')).toBeDisabled()
    expect(screen.getByTestId('member-role-locked')).toHaveTextContent('memberRoleLockedOwner')
  })

  it("lets an Owner change another Owner's role", () => {
    caps.role = 'Owner'
    render(<MembersPanel />)
    openEdit(3)
    expect(screen.getByTestId('member-role-select')).not.toBeDisabled()
    expect(screen.queryByTestId('member-role-locked')).toBeNull()
  })

  it('leaves the role picker editable for a regular member row', () => {
    render(<MembersPanel />)
    openEdit(1)
    expect(screen.getByTestId('member-role-select')).not.toBeDisabled()
    fireEvent.click(screen.getByText('save'))
    expect(updateMutate).toHaveBeenCalledWith(
      { id: 'bob', input: { roleId: 'r-member', departmentIds: [] } },
      expect.anything(),
    )
  })

  describe('two-factor authentication', () => {
    const row = (id: string) =>
      screen.getAllByTestId('member-row')[members.findIndex((m) => m._id === id)]

    it('shows the "2FA on" badge only for members with 2FA enabled', () => {
      render(<MembersPanel />)
      expect(within(row('ada')).getByTestId('member-mfa-badge')).toHaveTextContent('memberMfaOn')
      expect(within(row('me')).getByTestId('member-mfa-badge')).toBeInTheDocument()
      expect(within(row('bob')).queryByTestId('member-mfa-badge')).toBeNull()
      expect(within(row('olga')).queryByTestId('member-mfa-badge')).toBeNull()
    })

    it('never offers "Reset 2FA" to a non-Owner', () => {
      render(<MembersPanel />)
      expect(screen.queryAllByLabelText('memberMfaReset')).toHaveLength(0)
    })

    it('offers "Reset 2FA" to an Owner on other privileged members, never on their own row', () => {
      caps.role = 'Owner'
      render(<MembersPanel />)
      expect(within(row('me')).queryByLabelText('memberMfaReset')).toBeNull()
      expect(within(row('bob')).queryByLabelText('memberMfaReset')).toBeNull()
      expect(within(row('eve')).queryByLabelText('memberMfaReset')).toBeNull()
      expect(within(row('olga')).getByLabelText('memberMfaReset')).toBeInTheDocument()
      expect(within(row('ada')).getByLabelText('memberMfaReset')).toBeInTheDocument()
    })

    it('asks for confirmation before resetting', () => {
      caps.role = 'Owner'
      render(<MembersPanel />)
      fireEvent.click(within(row('ada')).getByLabelText('memberMfaReset'))
      expect(resetMfaMutate).not.toHaveBeenCalled()

      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('memberMfaResetTitle')).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: 'memberMfaReset' }))
      expect(resetMfaMutate).toHaveBeenCalledWith('ada', expect.anything())
    })

    it('cancelling the confirmation resets nothing', () => {
      caps.role = 'Owner'
      render(<MembersPanel />)
      fireEvent.click(within(row('olga')).getByLabelText('memberMfaReset'))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'cancel' }))
      expect(resetMfaMutate).not.toHaveBeenCalled()
    })
  })
})
