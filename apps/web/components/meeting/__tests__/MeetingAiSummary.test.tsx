import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import type { Meeting } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'

const api = vi.hoisted(() => ({ summary: vi.fn(), regenerateSummary: vi.fn() }))
const push = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('@/lib/api/meetings', () => ({ meetingsApi: api }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { MeetingAiSummary } from '@/components/meeting/detail/MeetingAiSummary'

function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    id: 'm1', code: 'abc-defg-hjk', title: 'Weekly', host: { userId: 'h', displayName: 'Lan' },
    status: 'ENDED', settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'host', aiNotesEverEnabled: true,
    createdAt: '2026-10-08T00:00:00Z', ...over,
  }
}

const DONE = {
  state: 'DONE', inGroup: true, groupConversationId: 'c9',
  summary: { overview: 'The overview', keyPoints: ['kp1'], decisions: ['dec1'],
    actionItems: [{ text: 'Ship', assigneeName: 'Binh' }], fromMaterials: [], language: 'en' },
}

function conflict(code: string): AxiosError {
  const response = { status: 409, data: { code }, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError('Conflict raw text', 'ERR', undefined, undefined, response as AxiosResponse)
}

function renderBlock(m: Meeting) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MeetingAiSummary meeting={m} /></QueryClientProvider>)
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.clearAllMocks())

describe('MeetingAiSummary', () => {
  it('renders nothing when AI was never on (state null)', async () => {
    api.summary.mockResolvedValue({ state: null, inGroup: false })
    const { container } = renderBlock(meeting())
    await waitFor(() => expect(api.summary).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the progress line while PENDING, no regenerate button', async () => {
    api.summary.mockResolvedValue({ state: 'PENDING', inGroup: false })
    renderBlock(meeting())
    expect(await screen.findByText('aiSummaryPending')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'aiSummaryRegenerate' })).not.toBeInTheDocument()
  })

  it('shows the empty line for EMPTY', async () => {
    api.summary.mockResolvedValue({ state: 'EMPTY', inGroup: false })
    renderBlock(meeting())
    expect(await screen.findByText('aiSummaryEmpty')).toBeInTheDocument()
  })

  it('FAILED: message + regenerate for a host, none for an attendee', async () => {
    api.summary.mockResolvedValue({ state: 'FAILED', inGroup: false })
    const { unmount } = renderBlock(meeting())
    expect(await screen.findByText('aiSummaryFailed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'aiSummaryRegenerate' })).toBeInTheDocument()
    unmount()
    renderBlock(meeting({ viewerRole: 'invited' }))
    expect(await screen.findByText('aiSummaryFailed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'aiSummaryRegenerate' })).not.toBeInTheDocument()
  })

  it('DONE: content, open-group (inGroup) and regenerate (cohost)', async () => {
    api.summary.mockResolvedValue(DONE)
    renderBlock(meeting({ viewerRole: 'cohost' }))
    expect(await screen.findByText('The overview')).toBeInTheDocument()
    expect(screen.getByText('dec1')).toBeInTheDocument()
    expect(screen.getByText('Ship — Binh')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'aiSummaryOpenGroup' }))
    expect(push).toHaveBeenCalledWith('/conversations/c9')
    expect(screen.getByRole('button', { name: 'aiSummaryRegenerate' })).toBeInTheDocument()
  })

  it('DONE: no open-group when not inGroup, no regenerate for an attendee', async () => {
    api.summary.mockResolvedValue({ ...DONE, inGroup: false, groupConversationId: undefined })
    renderBlock(meeting({ viewerRole: 'invited' }))
    expect(await screen.findByText('The overview')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'aiSummaryOpenGroup' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'aiSummaryRegenerate' })).not.toBeInTheDocument()
  })

  it('regenerate success flips the block to PENDING', async () => {
    api.summary.mockResolvedValue(DONE)
    api.regenerateSummary.mockResolvedValue({ state: 'PENDING' })
    renderBlock(meeting())
    await userEvent.click(await screen.findByRole('button', { name: 'aiSummaryRegenerate' }))
    expect(api.regenerateSummary).toHaveBeenCalledWith('m1')
    expect(await screen.findByText('aiSummaryPending')).toBeInTheDocument()
  })

  it.each([
    ['MEETING_SUMMARY_PENDING', 'errSummaryPending'],
    ['MEETING_SUMMARY_UNAVAILABLE', 'errSummaryUnavailable'],
  ])('409 %s shows a translated toast, not the raw text', async (code, key) => {
    api.summary.mockResolvedValue({ state: 'FAILED', inGroup: false })
    api.regenerateSummary.mockRejectedValue(conflict(code))
    renderBlock(meeting())
    await userEvent.click(await screen.findByRole('button', { name: 'aiSummaryRegenerate' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(key))
    expect(toast.error).not.toHaveBeenCalledWith('Conflict raw text')
  })
})
