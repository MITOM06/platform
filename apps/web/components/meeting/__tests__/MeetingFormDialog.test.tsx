import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
const auth = vi.hoisted(() => ({ getMyDepartments: vi.fn(), searchUsers: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const push = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api/meetings', () => ({ meetingsApi: api }))
vi.mock('@/lib/api/auth', () => ({ authService: auth }))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key,
  useLocale: () => 'en',
}))

import { MeetingFormDialog } from '@/components/meeting/MeetingFormDialog'

const NOW = new Date('2026-10-08T02:10:00Z')

function renderDialog(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MeetingFormDialog request={{ mode: 'create', now: NOW }} onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

function invalid(field: string, max?: number): AxiosError {
  const response = { status: 400, data: { code: 'MEETING_INVALID', params: { field, ...(max ? { max } : {}) } },
    statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  return new AxiosError('bad', 'ERR', undefined, undefined, response as AxiosResponse)
}

beforeEach(() => {
  // Radix Switch/Select measure themselves; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
  auth.getMyDepartments.mockResolvedValue([])
})
afterEach(() => vi.clearAllMocks())

describe('MeetingFormDialog', () => {
  it('shows a server field error inline instead of a toast', async () => {
    api.create.mockRejectedValue(invalid('title', 120))
    const user = userEvent.setup()
    renderDialog()
    await user.type(screen.getByLabelText('fieldTitle'), 'Sprint review')
    await user.click(screen.getByRole('button', { name: 'submitCreate' }))
    expect(await screen.findByText('valTitleTooLong(120)')).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('starts an instant meeting and opens the room when "Start now" is picked', async () => {
    api.create.mockResolvedValue({ id: 'm9', code: 'xyz-wxyz-xyz', status: 'SCHEDULED' })
    const user = userEvent.setup()
    const onClose = renderDialog()
    await user.click(screen.getByRole('radio', { name: 'whenNow' }))
    await user.click(screen.getByRole('button', { name: 'submitStartNow' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/meet/xyz-wxyz-xyz'))
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('scheduledStart')
    expect(onClose).toHaveBeenCalled()
  })

  it('offers the caller departments (gap B1) only when there are some', async () => {
    auth.getMyDepartments.mockResolvedValue([{ id: 'd1', name: 'Sales' }])
    renderDialog()
    expect(await screen.findByText('fieldDepartment')).toBeInTheDocument()
  })

  it('hides the department field for someone without departments', async () => {
    renderDialog()
    await waitFor(() => expect(auth.getMyDepartments).toHaveBeenCalled())
    expect(screen.queryByText('fieldDepartment')).not.toBeInTheDocument()
  })
})
