import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'

const api = vi.hoisted(() => ({ getNote: vi.fn(), putNote: vi.fn() }))
vi.mock('@/lib/api/meetings', () => ({ meetingsApi: api }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key,
  useLocale: () => 'en',
}))
vi.mock('@/components/chat/MarkdownContent', () => ({ MarkdownContent: ({ content }: { content: string }) => <div>{content}</div> }))

import { NotesEditor } from '@/components/meeting/NotesEditor'

function conflict(latest: unknown): AxiosError {
  const response = { status: 409, data: { code: 'MEETING_NOTE_CONFLICT', statusCode: 409, latest },
    statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError('conflict', 'ERR', undefined, undefined, response as AxiosResponse)
}

function renderEditor(onFlushReady?: (flush: () => Promise<void>) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <NotesEditor meetingId="m1" canEditShared onFlushReady={onFlushReady} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  // ResponsiveModal → useIsMobile reads matchMedia, which jsdom lacks (same stub as responsive-modal.test.tsx).
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
  api.getNote.mockResolvedValue({ scope: 'shared', content: 'base', version: 1 })
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('NotesEditor', () => {
  it('autosaves 2 seconds after typing stops', async () => {
    api.putNote.mockResolvedValue({ scope: 'shared', content: 'base!', version: 2 })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderEditor()
    const box = await screen.findByRole('textbox', { name: 'notesShared' })
    await user.type(box, '!')
    expect(api.putNote).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(2000) })
    await waitFor(() => expect(api.putNote).toHaveBeenCalledWith('m1', 'shared', { content: 'base!', version: 1 }))
    expect(await screen.findByText('notesSaved')).toBeInTheDocument()
  })

  it('on 409 keeps the typed text, explains, and "keep mine" saves over the newer version', async () => {
    api.putNote
      .mockRejectedValueOnce(conflict({ scope: 'shared', content: 'base theirs', version: 2,
        updatedBy: { userId: 'u2', displayName: 'Minh' } }))
      .mockResolvedValueOnce({ scope: 'shared', content: 'base mine', version: 3 })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderEditor()
    const box = await screen.findByRole('textbox', { name: 'notesShared' })
    await user.clear(box)
    await user.type(box, 'base mine')
    await act(async () => { vi.advanceTimersByTime(2000) })

    expect(await screen.findByRole('alert')).toHaveTextContent('notesConflictTitle')
    expect(box).toHaveValue('base mine')

    await user.click(screen.getByRole('button', { name: 'notesConflictReview' }))
    await user.click(await screen.findByRole('button', { name: 'notesConflictKeepMine' }))
    await act(async () => { vi.advanceTimersByTime(2000) })
    await waitFor(() =>
      expect(api.putNote).toHaveBeenLastCalledWith('m1', 'shared', { content: 'base mine', version: 2 }))
    expect(box).toHaveValue('base mine')
  })

  it('is read-only with an explanation when the user may not edit', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><NotesEditor meetingId="m1" canEditShared={false} /></QueryClientProvider>)
    const box = await screen.findByRole('textbox', { name: 'notesShared' })
    expect(box).toHaveAttribute('readonly')
    expect(screen.getByText('notesReadOnly')).toBeInTheDocument()
  })

  it('hands the room a flush that saves unsaved text right away (leaving the meeting)', async () => {
    api.putNote.mockResolvedValue({ scope: 'shared', content: 'base?', version: 2 })
    let flush: (() => Promise<void>) | undefined
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderEditor((f) => { flush = f })
    const box = await screen.findByRole('textbox', { name: 'notesShared' })
    await user.type(box, '?')
    expect(flush).toBeDefined()
    await act(async () => { await flush?.() })
    expect(api.putNote).toHaveBeenCalledWith('m1', 'shared', { content: 'base?', version: 1 })
  })
})
