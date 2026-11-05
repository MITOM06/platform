import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Conversation } from '@/lib/api/types'

const rename = vi.fn()
const create = vi.fn()
vi.mock('@/lib/api/ai-threads', () => ({
  aiThreadsApi: { list: vi.fn().mockResolvedValue([]), create: () => create(), rename: (...a: unknown[]) => rename(...a) },
}))
import { useCreateAiThread, useRenameAiThread } from '@/lib/hooks/use-ai-threads'

function setup(initial: Conversation[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(['ai-threads'], initial)
  const Wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrap }
}

describe('ai thread mutations', () => {
  it('create inserts at top and returns conversation', async () => {
    create.mockResolvedValue({ id: 'n' })
    const { qc, Wrap } = setup([{ id: 'a' } as Conversation])
    const { result } = renderHook(() => useCreateAiThread(), { wrapper: Wrap })
    let out: Conversation | undefined
    await act(async () => { out = await result.current.mutateAsync() })
    expect(out?.id).toBe('n')
    expect(qc.getQueryData<Conversation[]>(['ai-threads'])?.map((c) => c.id)).toEqual(['n', 'a'])
  })
  it('rename updates the cached thread name', async () => {
    rename.mockResolvedValue({ id: 'a', name: 'X' })
    const { qc, Wrap } = setup([{ id: 'a', name: null } as Conversation])
    const { result } = renderHook(() => useRenameAiThread(), { wrapper: Wrap })
    await act(async () => { await result.current.mutateAsync({ id: 'a', name: 'X' }) })
    await waitFor(() => expect(qc.getQueryData<Conversation[]>(['ai-threads'])?.[0].name).toBe('X'))
  })
})
