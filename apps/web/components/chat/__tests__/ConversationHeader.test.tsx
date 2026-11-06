import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ConversationHeader } from '@/components/chat/ConversationHeader'

let conv: Record<string, unknown>
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next-intl', () => ({ useTranslations: (ns: string) => (key: string) => `${ns}.${key}` }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ setQueryData: vi.fn() }) }))
vi.mock('@/lib/hooks/use-conversation', () => ({ useConversation: () => ({ data: conv }) }))
vi.mock('@/lib/hooks/use-user-status', () => ({ useUserStatus: () => ({ data: undefined }) }))
vi.mock('@/lib/hooks/use-relationship', () => ({ useRelationship: () => ({ relationship: undefined }) }))
vi.mock('@/lib/store/auth.store', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { id: 'u1' } }) }))
vi.mock('@/lib/hooks/use-user', () => ({ useUser: () => ({ data: undefined }) }))
vi.mock('@/lib/hooks/use-assistant', () => ({ useAssistant: () => ({ data: undefined }) }))
vi.mock('@/lib/hooks/use-ai-threads', () => ({ useCreateAiThread: () => ({ mutate: vi.fn(), isPending: false }) }))
vi.mock('@/lib/media', () => ({ absoluteMediaUrl: (u: string) => u }))
vi.mock('@/lib/nicknames', () => ({ useNickname: () => undefined }))
vi.mock('@/components/chat/PinnedMessagesBar', () => ({ PinnedMessagesBar: () => null }))
vi.mock('@/components/chat/ConversationSettingsDrawer', () => ({ ConversationSettingsDrawer: () => null }))
vi.mock('@/components/chat/GroupSettingsDrawer', () => ({ GroupSettingsDrawer: () => null }))
vi.mock('@/components/chat/SharedMediaGallery', () => ({ SharedMediaGallery: () => null }))
vi.mock('@/components/chat/UserProfileDrawer', () => ({ UserProfileDrawer: () => null }))
vi.mock('@/components/call/StartCallSheet', () => ({ StartCallSheet: () => null }))

function aiConv(name: string | null) {
  return {
    id: 't1', participants: ['u1', 'ai-bot-000000000000000000000001'], type: 'direct', name,
    avatarUrl: null, pinnedMessages: [],
  }
}

describe('ConversationHeader (AI thread title)', () => {
  it.each([[''], ['   '], [null]])('falls back to the untitled label for name %j', (name) => {
    conv = aiConv(name)
    render(<ConversationHeader conversationId="t1" typingUserIds={[]} onSearchToggle={() => {}} />)
    expect(screen.getByText('aiThreads.untitled')).toBeTruthy()
  })

  it('shows the thread name when set', () => {
    conv = aiConv('Báo cáo Q3')
    render(<ConversationHeader conversationId="t1" typingUserIds={[]} onSearchToggle={() => {}} />)
    expect(screen.getByText('Báo cáo Q3')).toBeTruthy()
  })
})
