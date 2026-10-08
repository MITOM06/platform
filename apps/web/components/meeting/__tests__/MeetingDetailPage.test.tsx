import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import type { Meeting } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'

const api = vi.hoisted(() => ({ get: vi.fn(), messages: vi.fn(), getNote: vi.fn(), putNote: vi.fn() }))
vi.mock('@/lib/api/meetings', () => ({ meetingsApi: api }))
vi.mock('@/lib/api/auth', () => ({ authService: { getMyDepartments: vi.fn().mockResolvedValue([]) } }))
vi.mock('@/lib/hooks/use-capabilities', () => ({ useHasCapability: () => true }))
vi.mock('@/lib/hooks/use-admin', () => ({ useDepartments: () => ({ data: [] }) }))
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'm1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key,
  useLocale: () => 'en',
  useNow: () => new Date('2026-10-08T03:00:00Z'),
}))
vi.mock('@/components/chat/MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => <div>{content}</div>,
}))

import MeetingDetailPage from '@/app/(main)/meetings/[id]/page'

const RAW_ID = '64b0aaaaaaaaaaaaaaaaaaaa'

function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    id: 'm1', code: 'abc-defg-hjk', title: 'Weekly', host: { userId: 'h', displayName: 'Lan' },
    status: 'LIVE', settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'invited',
    createdAt: '2026-10-08T00:00:00Z', ...over,
  }
}

function forbidden(code: string): AxiosError {
  const response = { status: 403, data: { code, statusCode: 403 }, statusText: '', headers: {},
    config: { headers: new AxiosHeaders() } }
  return new AxiosError('Forbidden', 'ERR', undefined, undefined, response as AxiosResponse)
}

const page = (content: unknown[] = []) => ({ content, page: 0, size: 50, totalElements: content.length, hasNext: false })

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MeetingDetailPage /></QueryClientProvider>)
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
  api.getNote.mockResolvedValue({ scope: 'shared', content: 'agenda', version: 1 })
  api.messages.mockResolvedValue(page())
})
afterEach(() => vi.clearAllMocks())

describe('meeting detail page', () => {
  it('replaces the records with a calm notice when the viewer was removed', async () => {
    api.get.mockResolvedValue(meeting())
    api.messages.mockRejectedValue(forbidden('MEETING_REMOVED'))
    renderPage()
    expect(await screen.findByText('removedNotice')).toBeInTheDocument()
    expect(screen.queryByText('sectionNotes')).not.toBeInTheDocument()
    expect(screen.queryByText('errRemoved')).not.toBeInTheDocument()
  })

  it('tells a guest of a live meeting to join to see notes and chat', async () => {
    api.get.mockResolvedValue(meeting({ viewerRole: 'guest' }))
    api.messages.mockRejectedValue(forbidden('MEETING_FORBIDDEN'))
    renderPage()
    expect(await screen.findByText('guestNotice')).toBeInTheDocument()
    expect(screen.queryByText('sectionNotes')).not.toBeInTheDocument()
  })

  it('shows the records to a guest who attended (server allows it)', async () => {
    api.get.mockResolvedValue(meeting({ viewerRole: 'guest', status: 'ENDED', endedAt: '2026-10-08T02:00:00Z' }))
    api.messages.mockResolvedValue(page([
      { id: 'x1', sender: { userId: 'a', displayName: 'An' }, content: 'see you', createdAt: '2026-10-08T01:00:00Z' },
    ]))
    renderPage()
    expect(await screen.findByText('see you')).toBeInTheDocument()
    expect(screen.getByText('sectionNotes')).toBeInTheDocument()
    expect(screen.queryByText('guestNotice')).not.toBeInTheDocument()
  })

  it('offers host actions and never renders raw ids', async () => {
    api.get.mockResolvedValue(meeting({
      status: 'SCHEDULED', viewerRole: 'host', scheduledStart: '2026-10-09T02:00:00Z',
      removedIds: [RAW_ID], invitees: [{ userId: RAW_ID, displayName: RAW_ID }],
    }))
    renderPage()
    expect(await screen.findByRole('button', { name: 'edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cancelMeeting' })).toBeInTheDocument()
    expect(screen.getByText('participantFallback')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(RAW_ID)
  })

  it('shows "not found" for a missing meeting', async () => {
    const response = { status: 404, data: { code: 'MEETING_NOT_FOUND' }, statusText: '', headers: {},
      config: { headers: new AxiosHeaders() } }
    api.get.mockRejectedValue(new AxiosError('nf', 'ERR', undefined, undefined, response as AxiosResponse))
    renderPage()
    expect(await screen.findByText('errNotFound')).toBeInTheDocument()
  })
})
