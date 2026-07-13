import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { EditMemberAiContextModal } from '@/components/admin/EditMemberAiContextModal'
import type { Member } from '@/lib/api/admin-types'

const mutate = vi.fn()

const MEMBER_CTX = { userId: 't', jobTitle: 'Dev', projects: ['PON'], style: '', preferences: '', updatedBy: 'a' }

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/hooks/use-ai-context', () => ({
  useMemberAiContext: () => ({ data: MEMBER_CTX }),
  useUpdateMemberHard: () => ({ mutate, isPending: false }),
}))

const member: Member = { _id: 'target', displayName: 'Bob', email: 'b@x.io' } as Member

describe('EditMemberAiContextModal', () => {
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

  it('submits jobTitle + parsed projects (one per line)', () => {
    render(<EditMemberAiContextModal member={member} open onOpenChange={() => {}} />)
    const projects = screen.getByLabelText('aiContextProjects') as HTMLTextAreaElement
    fireEvent.change(projects, { target: { value: 'PON\nBotFactory\n' } })
    fireEvent.click(screen.getByText('save'))
    expect(mutate).toHaveBeenCalledWith(
      { userId: 'target', body: { jobTitle: 'Dev', projects: ['PON', 'BotFactory'] } },
      expect.anything(),
    )
  })
})
