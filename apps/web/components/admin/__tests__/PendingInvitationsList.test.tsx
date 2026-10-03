import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { PendingInvitationsList } from '@/components/admin/PendingInvitationsList'
import type { Invitation } from '@/lib/api/admin-types'

const resendMutate = vi.fn()
const revokeMutate = vi.fn()
let invitations: Invitation[] = []

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: () => 'Oct 8, 2026' }),
}))
vi.mock('@/lib/hooks/use-admin', () => ({
  useInvitations: () => ({ data: invitations }),
  useResendInvitation: () => ({ mutate: resendMutate, isPending: false, variables: undefined }),
  useRevokeInvitation: () => ({ mutate: revokeMutate, isPending: false }),
}))

const base: Invitation = {
  _id: 'inv-1',
  email: 'jane@acme.com',
  roleId: 'r-member',
  roleName: 'Member',
  departmentIds: [],
  invitedBy: { id: 'u-1', displayName: 'Khang' },
  status: 'pending',
  expiresAt: '2026-10-08T09:00:00.000Z',
  createdAt: '2026-10-01T09:00:00.000Z',
  lastSentAt: '2026-10-01T09:00:00.000Z',
  sendCount: 1,
  acceptedAt: null,
  acceptedVia: null,
}

describe('PendingInvitationsList', () => {
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

  it('renders nothing when there are no actionable invitations', () => {
    invitations = [{ ...base, status: 'accepted' }]
    const { container } = render(<PendingInvitationsList />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the expired badge and resends on click', () => {
    invitations = [{ ...base, status: 'expired' }]
    render(<PendingInvitationsList />)
    expect(screen.getByText('inviteStatusExpired')).toBeInTheDocument()
    expect(screen.getByText('jane@acme.com')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('inviteResend'))
    expect(resendMutate).toHaveBeenCalledWith('inv-1')
  })
})
