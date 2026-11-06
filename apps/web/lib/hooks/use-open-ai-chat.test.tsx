import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Conversation } from '@/lib/api/types'

const push = vi.fn()
const list = vi.fn()
const create = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/lib/api/ai-threads', () => ({
  aiThreadsApi: { list: () => list(), create: () => create(), rename: vi.fn() },
}))

import { useOpenAiChat } from '@/lib/hooks/use-open-ai-chat'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    qc,
    Wrap: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  }
}

beforeEach(() => {
  push.mockReset()
  list.mockReset()
  create.mockReset()
})

describe('useOpenAiChat', () => {
  it('opens the newest thread', async () => {
    list.mockResolvedValue([{ id: 'new' }, { id: 'old' }] as Conversation[])
    const { Wrap } = wrapper()
    const { result } = renderHook(() => useOpenAiChat(), { wrapper: Wrap })
    await act(() => result.current.openAiChat())
    expect(push).toHaveBeenCalledWith('/conversations/new')
    expect(create).not.toHaveBeenCalled()
  })
  it('creates a thread when none exist', async () => {
    list.mockResolvedValue([])
    create.mockResolvedValue({ id: 'fresh' } as Conversation)
    const { Wrap, qc } = wrapper()
    const { result } = renderHook(() => useOpenAiChat(), { wrapper: Wrap })
    await act(() => result.current.openAiChat())
    expect(push).toHaveBeenCalledWith('/conversations/fresh')
    expect(qc.getQueryData<Conversation[]>(['ai-threads'])?.[0].id).toBe('fresh')
  })
})
