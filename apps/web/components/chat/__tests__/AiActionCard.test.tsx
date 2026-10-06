import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { AiActionCard } from '@/components/chat/AiActionCard'
import { useAuthStore } from '@/lib/store/auth.store'
import type { AiPendingAction } from '@/lib/api/types'

const confirm = vi.hoisted(() => vi.fn())
const setStatus = vi.hoisted(() => vi.fn())

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'en',
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/api/ai-actions', () => ({
  aiActionsService: { confirm, cancel: vi.fn() },
}))
vi.mock('@/lib/hooks/use-display-names', () => ({
  useNameResolver: () => (id: string) => (id === 'bob' ? 'Bob' : undefined),
}))
vi.mock('@/lib/hooks/use-connectors', () => ({
  useProviderNameSources: () => ({ catalog: [{ id: 'gmail', name: 'Gmail' }] }),
}))
vi.mock('@/lib/hooks/use-message-cache', () => ({
  useMessageCache: () => ({ setPendingActionStatus: setStatus }),
}))

const future = new Date(Date.now() + 10 * 60 * 1000).toISOString()

let qc: QueryClient

function renderCard(action: AiPendingAction) {
  // gcTime 0: no 5-minute cache timers keeping the worker alive after the test.
  qc = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 }, queries: { gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <AiActionCard action={action} conversationId="c1" />
    </QueryClientProvider>,
  )
}

describe('AiActionCard', () => {
  afterEach(() => {
    cleanup()
    qc?.clear()
  })

  beforeEach(() => {
    confirm.mockReset()
    setStatus.mockReset()
    useAuthStore.setState({ user: { id: 'me', email: 'me@x.io', displayName: 'Me' }, accessToken: 't' })
  })

  it('shows Confirm / Cancel to the requester and never the raw tool or provider', () => {
    renderCard({
      id: 'a-1', toolName: 'mcp__gmail__send_email', provider: 'gmail', status: 'pending',
      expiresAt: future, requesterId: 'me', summary: { kind: 'send_email', to: 'x@y.io' },
    })
    expect(screen.getByText('aiActionConfirm')).toBeInTheDocument()
    expect(screen.getByText('aiActionCancel')).toBeInTheDocument()
    expect(screen.getByText('aiActionSendEmail')).toBeInTheDocument()
    expect(screen.getByText('aiActionVia:{"connector":"Gmail"}')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('mcp__')
  })

  it('others see who has to confirm, no buttons', () => {
    renderCard({ id: 'a-2', status: 'pending', expiresAt: future, requesterId: 'bob', provider: 'custom_ab' })
    expect(screen.queryByText('aiActionConfirm')).toBeNull()
    expect(screen.getByTestId('ai-action-status')).toHaveTextContent('aiActionWaitingFor:{"name":"Bob"}')
    expect(screen.getByText('aiActionViaGeneric')).toBeInTheDocument()
  })

  it('confirming disables the buttons, then shows the outcome', async () => {
    let resolve: (v: { status: string }) => void = () => {}
    confirm.mockReturnValue(new Promise((r) => (resolve = r)))
    renderCard({ id: 'a-3', status: 'pending', expiresAt: future, requesterId: 'me' })
    fireEvent.click(screen.getByText('aiActionConfirm'))
    await waitFor(() => expect(screen.getByText('aiActionCancel').closest('button')).toBeDisabled())
    resolve({ status: 'confirmed' })
    await waitFor(() =>
      expect(screen.getByTestId('ai-action-status')).toHaveTextContent('aiActionStatusConfirmed'),
    )
    expect(setStatus).toHaveBeenCalledWith('a-3', 'confirmed')
  })
})
