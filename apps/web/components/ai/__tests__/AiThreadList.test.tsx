import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { AiThreadList } from '@/components/ai/AiThreadList'
import type { Conversation } from '@/lib/api/types'
import * as cache from '@/lib/realtime/conversation-cache'

const push = vi.fn()
const replace = vi.fn()
const order: string[] = []
let pathname = '/conversations/t1'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => pathname,
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/components/common/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onConfirm, confirmLabel }: { open: boolean; onConfirm: () => void; confirmLabel: string }) =>
    open ? <button onClick={onConfirm}>{`confirm:${confirmLabel}`}</button> : null,
}))

const threadsState: { data: Conversation[] | undefined } = { data: [] }
const createMutateAsync = vi.fn()
const renameMutateAsync = vi.fn()
vi.mock('@/lib/hooks/use-ai-threads', () => ({
  useAiThreads: () => ({ data: threadsState.data, isLoading: false, isError: false }),
  useCreateAiThread: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useRenameAiThread: () => ({ mutateAsync: renameMutateAsync, isPending: false }),
}))
const deleteConversation = vi.fn()
vi.mock('@/lib/api/chat', () => ({
  chatService: { deleteConversation: (id: string) => deleteConversation(id) },
}))

function thread(id: string, name: string | null): Conversation {
  return {
    id, participants: ['u1', 'ai-bot-000000000000000000000001'], type: 'direct', name,
    avatarUrl: null, wallpaper: null, admins: [], createdBy: 'u1', isPublic: false,
    status: 'accepted', isMuted: false, isArchived: false, pinnedMessages: [],
    autoDeleteSeconds: null, lastMessage: null, lastMessageAt: null, unreadCount: 0,
  }
}

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AiThreadList />
    </QueryClientProvider>,
  )
}

describe('AiThreadList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    order.length = 0
    pathname = '/conversations/t1'
    threadsState.data = [thread('t1', 'Báo cáo Q3'), thread('t2', null)]
  })

  it('renders titles in order, falling back to the untitled label, and highlights the active one', () => {
    renderList()
    const rows = screen.getAllByTestId('ai-thread-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Báo cáo Q3')
    expect(rows[1].textContent).toContain('untitled')
    expect(rows[0].getAttribute('aria-current')).toBe('page')
    expect(rows[1].getAttribute('aria-current')).toBeNull()
  })

  it('links back to the normal conversation list', () => {
    renderList()
    expect(screen.getByText('backToMessages').closest('a')?.getAttribute('href')).toBe('/conversations')
  })

  it('creates a new thread and navigates to it', async () => {
    createMutateAsync.mockResolvedValue(thread('t9', null))
    renderList()
    fireEvent.click(screen.getByText('newThread'))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/conversations/t9'))
  })

  it('renames inline: Enter saves, Escape cancels', async () => {
    renameMutateAsync.mockResolvedValue(thread('t1', 'Mới'))
    renderList()
    fireEvent.click(screen.getAllByLabelText('rename')[0])
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  Mới  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(renameMutateAsync).toHaveBeenCalledWith({ id: 't1', name: 'Mới' }))
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())

    fireEvent.click(screen.getAllByLabelText('rename')[0])
    const input2 = screen.getByRole('textbox')
    fireEvent.change(input2, { target: { value: 'Khác' } })
    fireEvent.keyDown(input2, { key: 'Escape' })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(renameMutateAsync).toHaveBeenCalledTimes(1)
  })

  it('shows a localized message (never raw error text) on AI_THREAD_NAME_INVALID', async () => {
    const err = new axios.AxiosError('raw english', '400', undefined, undefined, {
      status: 400, data: { code: 'AI_THREAD_NAME_INVALID', message: 'raw english' },
    } as never)
    renameMutateAsync.mockRejectedValue(err)
    const { toast } = await import('sonner')
    renderList()
    fireEvent.click(screen.getAllByLabelText('rename')[0])
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'x' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('nameInvalid'))
  })

  it('delete asks for confirmation, then navigates to the next thread when the open one is removed', async () => {
    deleteConversation.mockResolvedValue({})
    renderList()
    fireEvent.click(screen.getAllByLabelText('delete')[0])
    expect(deleteConversation).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(/^confirm:/))
    await waitFor(() => expect(deleteConversation).toHaveBeenCalledWith('t1'))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/conversations/t2'))
    expect(push).not.toHaveBeenCalled()
  })

  it('goes to /ai-hub when the last open thread is deleted', async () => {
    threadsState.data = [thread('t1', 'A')]
    deleteConversation.mockResolvedValue({})
    renderList()
    fireEvent.click(screen.getByLabelText('delete'))
    fireEvent.click(screen.getByText(/^confirm:/))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/ai-hub'))
  })

  it('navigates away before dropping the deleted thread from the cache', async () => {
    deleteConversation.mockResolvedValue({})
    replace.mockImplementation(() => order.push('replace'))
    const spy = vi.spyOn(cache, 'dropConversation').mockImplementation(() => { order.push('drop') })
    renderList()
    fireEvent.click(screen.getAllByLabelText('delete')[0])
    fireEvent.click(screen.getByText(/^confirm:/))
    await waitFor(() => expect(order).toEqual(['replace', 'drop']))
    spy.mockRestore()
  })

  it('does not navigate when a non-open thread is deleted', async () => {
    deleteConversation.mockResolvedValue({})
    renderList()
    fireEvent.click(screen.getAllByLabelText('delete')[1])
    fireEvent.click(screen.getByText(/^confirm:/))
    await waitFor(() => expect(deleteConversation).toHaveBeenCalledWith('t2'))
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })
})
