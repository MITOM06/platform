/**
 * Multi-select: one selection group at a time, recall only my own non-recalled
 * messages, partial delete failures keep the selection and show a localized
 * error (never the raw server text).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import axios from 'axios'
import type { Message } from '@/lib/api/types'

const h = vi.hoisted(() => ({
  deleteForMe: vi.fn(),
  recallMessage: vi.fn(),
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
  t: (k: string, v?: Record<string, unknown>) => (v ? `${k}(${JSON.stringify(v)})` : k),
}))
vi.mock('next-intl', () => ({ useTranslations: () => h.t }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/chat', () => ({
  chatService: { deleteForMe: h.deleteForMe, recallMessage: h.recallMessage },
}))

import { classifyType, useMultiSelect } from '@/lib/hooks/use-multi-select'

const ME = 'me'
const m = (id: string, over: Partial<Message> = {}) =>
  ({ id, senderId: ME, content: id, type: 'text', createdAt: 'x', conversationId: 'c', ...over }) as Message

const serverError = (code: string) =>
  new axios.AxiosError('boom', 'ERR', undefined, null, {
    status: 403,
    statusText: '',
    headers: {},
    config: {} as never,
    data: { code, message: 'java.lang.SecurityException: internal' },
  })

let forward: ReturnType<typeof vi.fn>
let optimistic: ReturnType<typeof vi.fn>

function render(messages: Message[]) {
  return renderHook(() => useMultiSelect(messages, ME, forward, optimistic))
}

beforeEach(() => {
  vi.clearAllMocks()
  forward = vi.fn()
  optimistic = vi.fn()
  h.deleteForMe.mockResolvedValue(undefined)
  h.recallMessage.mockResolvedValue(undefined)
})

describe('classifyType', () => {
  it.each([
    ['image', 'image'], ['video', 'image'], ['file', 'file'],
    ['text', 'text'], ['ai', 'text'], ['sticker', 'text'], ['call_log', 'text'], ['system', 'text'],
  ] as const)('%s → %s', (type, group) => {
    expect(classifyType(type)).toBe(group)
  })
})

describe('selection', () => {
  it('toggles on and off; emptying the selection frees the type lock', () => {
    const a = m('a')
    const img = m('img', { type: 'image' })
    const { result } = render([a, img])
    act(() => result.current.enterMultiSelect())
    expect(result.current.multiSelectMode).toBe(true)

    act(() => result.current.toggleSelect(a))
    expect([...result.current.selectedIds]).toEqual(['a'])

    // Mismatched type rejected with a localized warning naming the locked group.
    act(() => result.current.toggleSelect(img))
    expect([...result.current.selectedIds]).toEqual(['a'])
    expect(h.toast.warning).toHaveBeenCalledWith(
      'multiSelectTypeWarning({"type":"msgTypeText"})',
      { duration: 2500 },
    )

    act(() => result.current.toggleSelect(a))
    expect(result.current.selectedIds.size).toBe(0)
    act(() => result.current.toggleSelect(img))
    expect([...result.current.selectedIds]).toEqual(['img'])
  })

  it('exit clears everything', () => {
    const { result } = render([m('a')])
    act(() => result.current.enterMultiSelect())
    act(() => result.current.toggleSelect(m('a')))
    act(() => result.current.exitMultiSelect())
    expect(result.current.multiSelectMode).toBe(false)
    expect(result.current.selectedIds.size).toBe(0)
  })
})

describe('canRecall', () => {
  it('only when every selected message is mine and not yet recalled', () => {
    const mine = m('a')
    const theirs = m('b', { senderId: 'bob' })
    const recalled = m('c', { recalled: true } as Partial<Message>)
    const { result, rerender } = render([mine, theirs, recalled])
    expect(result.current.canRecall).toBe(false) // empty selection

    act(() => result.current.toggleSelect(mine))
    expect(result.current.canRecall).toBe(true)
    act(() => result.current.toggleSelect(theirs))
    expect(result.current.canRecall).toBe(false)
    act(() => result.current.toggleSelect(theirs))
    act(() => result.current.toggleSelect(recalled))
    expect(result.current.canRecall).toBe(false)
    rerender()
  })

  it('a selected id that is no longer in the thread blocks recall', () => {
    const a = m('a')
    const hook = renderHook((p: { msgs: Message[] }) => useMultiSelect(p.msgs, ME, forward, optimistic), {
      initialProps: { msgs: [a] },
    })
    act(() => hook.result.current.toggleSelect(a))
    hook.rerender({ msgs: [] })
    expect(hook.result.current.canRecall).toBe(false)
  })
})

describe('bulk delete', () => {
  it('deletes each, hides them optimistically, exits and confirms with the count', async () => {
    const { result } = render([m('a'), m('b')])
    act(() => result.current.enterMultiSelect())
    act(() => result.current.toggleSelect(m('a')))
    act(() => result.current.toggleSelect(m('b')))
    await act(() => result.current.handleMultiDelete())
    expect(h.deleteForMe.mock.calls.map(([id]) => id)).toEqual(['a', 'b'])
    expect(optimistic).toHaveBeenCalledWith({ id: 'a', deletedFor: ['__me__'] })
    expect(optimistic).toHaveBeenCalledWith({ id: 'b', deletedFor: ['__me__'] })
    expect(h.toast.success).toHaveBeenCalledWith('multiDeleted({"count":2})')
    expect(result.current.multiSelectMode).toBe(false)
  })

  it('a partial failure hides only what succeeded, stays in select mode, shows a mapped error', async () => {
    h.deleteForMe.mockImplementation((id: string) =>
      id === 'b' ? Promise.reject(serverError('RATE_LIMITED')) : Promise.resolve(),
    )
    const { result } = render([m('a'), m('b')])
    act(() => result.current.enterMultiSelect())
    act(() => result.current.toggleSelect(m('a')))
    act(() => result.current.toggleSelect(m('b')))
    await act(() => result.current.handleMultiDelete())
    expect(optimistic).toHaveBeenCalledTimes(1)
    expect(optimistic).toHaveBeenCalledWith({ id: 'a', deletedFor: ['__me__'] })
    expect(h.toast.error).toHaveBeenCalledWith('errRateLimited')
    expect(String(h.toast.error.mock.calls[0][0])).not.toContain('java')
    expect(h.toast.success).not.toHaveBeenCalled()
    expect(result.current.multiSelectMode).toBe(true)
  })

  it('nothing selected → no request', async () => {
    const { result } = render([m('a')])
    await act(() => result.current.handleMultiDelete())
    expect(h.deleteForMe).not.toHaveBeenCalled()
  })

  it('an unknown failure falls back to the generic delete key', async () => {
    h.deleteForMe.mockRejectedValue(new Error('raw'))
    const { result } = render([m('a')])
    act(() => result.current.toggleSelect(m('a')))
    await act(() => result.current.handleMultiDelete())
    expect(h.toast.error).toHaveBeenCalledWith('deleteError')
  })
})

describe('bulk recall', () => {
  it('recalls only my own non-recalled messages', async () => {
    const mine = m('a')
    const theirs = m('b', { senderId: 'bob' })
    const { result } = render([mine, theirs])
    act(() => result.current.enterMultiSelect())
    act(() => result.current.toggleSelect(mine))
    act(() => result.current.toggleSelect(theirs))
    await act(() => result.current.handleMultiRecall())
    expect(h.recallMessage).toHaveBeenCalledTimes(1)
    expect(h.recallMessage).toHaveBeenCalledWith('a')
    expect(h.toast.success).toHaveBeenCalledWith('multiRecalled({"count":1})')
    expect(result.current.multiSelectMode).toBe(false)
  })

  it('no own message selected → no request', async () => {
    const theirs = m('b', { senderId: 'bob' })
    const { result } = render([theirs])
    act(() => result.current.toggleSelect(theirs))
    await act(() => result.current.handleMultiRecall())
    expect(h.recallMessage).not.toHaveBeenCalled()
  })

  it('a failed recall shows the mapped error and keeps the selection', async () => {
    h.recallMessage.mockRejectedValue(serverError('FORBIDDEN'))
    const { result } = render([m('a')])
    act(() => result.current.enterMultiSelect())
    act(() => result.current.toggleSelect(m('a')))
    await act(() => result.current.handleMultiRecall())
    expect(h.toast.error).toHaveBeenCalledWith('errForbidden')
    expect(result.current.multiSelectMode).toBe(true)
  })
})

describe('forward', () => {
  it('a single selection forwards it and exits; several show the hint', () => {
    const a = m('a')
    const b = m('b')
    const { result } = render([a, b])
    act(() => result.current.enterMultiSelect())
    act(() => result.current.toggleSelect(a))
    act(() => result.current.toggleSelect(b))
    act(() => result.current.handleMultiForward())
    expect(forward).not.toHaveBeenCalled()
    expect(h.toast.info).toHaveBeenCalledWith('multiForwardHint')

    act(() => result.current.toggleSelect(b))
    act(() => result.current.handleMultiForward())
    expect(forward).toHaveBeenCalledWith(a)
    expect(result.current.multiSelectMode).toBe(false)
  })
})
