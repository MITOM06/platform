/**
 * @mentions in the group composer: only humans other than me, only once their
 * name resolved (inserting `@<userId>` leaked raw ids), one batched lookup, and
 * keyboard navigation that wraps around.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Conversation } from '@/lib/api/types'

const h = vi.hoisted(() => ({ getUsers: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({ authService: { getUsers: h.getUsers } }))

import { useMentionAutocomplete } from '@/lib/hooks/use-mention-autocomplete'
import { useMentionParticipants } from '@/lib/hooks/use-mention-participants'
import { useAuthStore } from '@/lib/store/auth.store'
import { AI_BOT_ID } from '@/lib/constants'

const ANN = 'a'.repeat(24)
const BOB = 'b'.repeat(24)
const NONAME = 'c'.repeat(24)
const ME = 'd'.repeat(24)

const group = {
  id: 'g1',
  type: 'group',
  participants: [ME, ANN, BOB, NONAME, AI_BOT_ID, 'system', 'extbot:xyz'],
} as unknown as Conversation

let qc: QueryClient

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthStore.setState({ user: { id: ME, email: 'me@x', displayName: 'Me' }, accessToken: 't' })
  h.getUsers.mockResolvedValue([
    { id: ANN, displayName: 'Ann' },
    { id: BOB, displayName: 'Bobby' },
    { id: NONAME, displayName: NONAME }, // name is the raw id → never offered
  ])
})

describe('useMentionParticipants', () => {
  it('one batched lookup of humans other than me; unresolved names are left out', async () => {
    const { result, rerender } = renderHook(() => useMentionParticipants(group), { wrapper })
    // Names are read from the per-user cache the batch seeds; the composer re-renders on input.
    await waitFor(() => expect(qc.getQueryData(['user', BOB])).toBeDefined())
    rerender()
    expect(h.getUsers).toHaveBeenCalledTimes(1)
    expect(h.getUsers.mock.calls[0][0]).toEqual([ANN, BOB, NONAME])
    expect(result.current).toEqual([{ id: ANN, name: 'Ann' }, { id: BOB, name: 'Bobby' }])
    // Seeds the per-user cache for other consumers.
    expect(qc.getQueryData(['user', ANN])).toEqual({ id: ANN, displayName: 'Ann' })
  })

  it('a direct chat has no mention candidates and makes no request', () => {
    const direct = { ...group, type: 'direct' } as Conversation
    const { result } = renderHook(() => useMentionParticipants(direct), { wrapper })
    expect(result.current).toEqual([])
    expect(h.getUsers).not.toHaveBeenCalled()
  })
})

function setup(conversation: Conversation = group, initial = '') {
  let value = initial
  const setValue = vi.fn((v: React.SetStateAction<string>) => {
    value = typeof v === 'function' ? (v as (p: string) => string)(value) : v
  })
  const textarea = document.createElement('textarea')
  const textareaRef = { current: textarea }
  const hook = renderHook(
    (p: { value: string }) => useMentionAutocomplete({ conversation, value: p.value, setValue, textareaRef }),
    { wrapper, initialProps: { value: initial } },
  )
  return { hook, setValue, get value() { return value }, textarea }
}

const key = (k: string) => ({ key: k, preventDefault: vi.fn() }) as unknown as React.KeyboardEvent<HTMLTextAreaElement>

describe('useMentionAutocomplete', () => {
  async function ready(s: ReturnType<typeof setup>) {
    await waitFor(() => expect(h.getUsers).toHaveBeenCalled())
    await waitFor(() => expect(qc.getQueryData(['user', BOB])).toBeDefined())
    s.hook.rerender({ value: s.value })
  }

  it('opens on "@" + filter, case-insensitive, and closes when nothing matches', async () => {
    const s = setup()
    await ready(s)
    act(() => s.hook.result.current.updateFromInput('hi @BO', 6))
    expect(s.hook.result.current.isOpen).toBe(true)
    expect(s.hook.result.current.candidates).toEqual([{ id: BOB, name: 'Bobby' }])

    act(() => s.hook.result.current.updateFromInput('hi @zzz', 7))
    expect(s.hook.result.current.isOpen).toBe(false)
    act(() => s.hook.result.current.updateFromInput('no mention', 10))
    expect(s.hook.result.current.hasQuery).toBe(false)
  })

  it('never opens outside a group', () => {
    const s = setup({ ...group, type: 'direct' } as Conversation)
    act(() => s.hook.result.current.updateFromInput('@a', 2))
    expect(s.hook.result.current.isOpen).toBe(false)
  })

  it('arrows wrap around; Enter inserts "@Name " in place of the query and closes', async () => {
    const s = setup(group, 'hey @ and more')
    await ready(s)
    s.hook.rerender({ value: 'hey @ and more' })
    act(() => s.hook.result.current.updateFromInput('hey @ and more', 5))
    expect(s.hook.result.current.candidates.map((c) => c.name)).toEqual(['Ann', 'Bobby'])

    let consumed = false
    act(() => { consumed = s.hook.result.current.handleKey(key('ArrowUp')) })
    expect(consumed).toBe(true)
    expect(s.hook.result.current.activeIndex).toBe(1)
    act(() => { s.hook.result.current.handleKey(key('ArrowDown')) })
    expect(s.hook.result.current.activeIndex).toBe(0)
    act(() => { s.hook.result.current.handleKey(key('ArrowDown')) })
    expect(s.hook.result.current.activeIndex).toBe(1)

    act(() => { s.hook.result.current.handleKey(key('Enter')) })
    expect(s.value).toBe('hey @Bobby  and more')
    expect(s.hook.result.current.hasQuery).toBe(false)
  })

  it('Escape closes; other keys and a closed popover are not consumed', async () => {
    const s = setup()
    await ready(s)
    expect(s.hook.result.current.handleKey(key('Enter'))).toBe(false)
    act(() => s.hook.result.current.updateFromInput('@a', 2))
    let consumed = true
    act(() => { consumed = s.hook.result.current.handleKey(key('x')) })
    expect(consumed).toBe(false)
    act(() => { s.hook.result.current.handleKey(key('Escape')) })
    expect(s.hook.result.current.isOpen).toBe(false)
  })

  it('insert without an open query does nothing', () => {
    const s = setup()
    act(() => s.hook.result.current.insert({ id: ANN, name: 'Ann' }))
    expect(s.setValue).not.toHaveBeenCalled()
  })
})
