import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Conversation } from '@/lib/api/types'

const push = vi.fn()
const replace = vi.fn()
const deleteConversation = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }))
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/api/chat', () => ({
  chatService: { deleteConversation: (id: string) => deleteConversation(id) },
}))
vi.mock('@/lib/api/auth', () => ({ authService: {} }))
vi.mock('@/lib/hooks/use-relationship', () => ({
  useRelationship: () => ({ data: undefined, isLoading: false }),
}))

import { useConversationSettings } from '@/components/chat/use-conversation-settings'

const BOT = 'ai-bot-000000000000000000000001'

function conv(over: Partial<Conversation>): Conversation {
  return {
    id: 'c1', participants: ['me', BOT], type: 'direct', name: null, admins: [],
    ...over,
  } as Conversation
}

function setup(conversation: Conversation) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['ai-threads'], [conversation, conv({ id: 'other' })])
  const Wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(
    () => useConversationSettings({ conversation, currentUserId: 'me', onClose: vi.fn() }),
    { wrapper: Wrap },
  )
  return { qc, result }
}

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
  deleteConversation.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('confirm', () => true)
})

describe('useConversationSettings.handleDelete', () => {
  it('AI thread: replaces to /ai-hub and drops it from ai-threads', async () => {
    const { qc, result } = setup(conv({ id: 'c1' }))
    await act(() => result.current.handleDelete())
    expect(replace).toHaveBeenCalledWith('/ai-hub')
    expect(push).not.toHaveBeenCalled()
    expect(qc.getQueryData<Conversation[]>(['ai-threads'])?.map((c) => c.id)).toEqual(['other'])
  })

  it('non-AI conversation: pushes /conversations', async () => {
    const { result } = setup(conv({ id: 'c2', participants: ['me', 'bob'] }))
    await act(() => result.current.handleDelete())
    expect(push).toHaveBeenCalledWith('/conversations')
    expect(replace).not.toHaveBeenCalled()
  })

  it('group containing the bot is not treated as an AI thread', async () => {
    const { result } = setup(conv({ id: 'g', type: 'group', participants: ['me', 'bob', BOT] }))
    await act(() => result.current.handleDelete())
    expect(push).toHaveBeenCalledWith('/conversations')
  })
})
