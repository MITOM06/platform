import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { makeQueryWrapper } from '@/test/query-wrapper'

const h = vi.hoisted(() => ({ getNote: vi.fn(), putNote: vi.fn() }))
vi.mock('@/lib/api/meetings', () => ({ meetingsApi: { getNote: h.getNote, putNote: h.putNote } }))

import { useNoteEditor, NOTE_AUTOSAVE_MS } from '@/lib/hooks/use-note-editor'
import { meetingKeys } from '@/lib/meetings/cache-updates'

const note = (content: string, version: number) => ({ scope: 'shared', content, version })
const conflict = (latest: object) => {
  const e = new AxiosError('x')
  e.response = { status: 409, data: { code: 'MEETING_NOTE_CONFLICT', latest } } as AxiosResponse
  return e
}

beforeEach(() => {
  h.getNote.mockReset().mockResolvedValue(note('hello', 1))
  h.putNote.mockReset().mockImplementation(async (_m, _s, input: { content: string; version: number }) => note(input.content, input.version + 1))
})
afterEach(() => vi.useRealTimers())

function mount(opts: { enabled?: boolean; canEdit?: boolean; remote?: { version: number } | null } = {}) {
  const { qc, wrapper } = makeQueryWrapper()
  const r = renderHook((p: { remote?: { version: number } | null }) =>
    useNoteEditor('m1', 'shared', { enabled: opts.enabled ?? true, canEdit: opts.canEdit ?? true, remote: p.remote }),
  { wrapper, initialProps: { remote: opts.remote } })
  return { ...r, qc }
}

describe('useNoteEditor', () => {
  it('loads the note into a clean draft; read-only without edit rights', async () => {
    const { result } = mount({ canEdit: false })
    await waitFor(() => expect(result.current.state.status).toBe('clean'))
    expect(result.current.state.draft).toBe('hello')
    expect(result.current.readOnly).toBe(true)
    expect(result.current.loadError).toBeNull()
  })

  it('autosaves 2 s after the last edit and caches the saved note', async () => {
    const { result, qc } = mount()
    await waitFor(() => expect(result.current.state.status).toBe('clean'))
    vi.useFakeTimers()
    act(() => result.current.edit('hello world'))
    expect(result.current.state.status).toBe('dirty')
    await act(async () => { await vi.advanceTimersByTimeAsync(NOTE_AUTOSAVE_MS - 1) })
    expect(h.putNote).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(h.putNote).toHaveBeenCalledWith('m1', 'shared', { content: 'hello world', version: 1 })
    expect(result.current.state.status).toBe('saved')
    expect(qc.getQueryData(meetingKeys.note('m1', 'shared'))).toEqual(note('hello world', 2))
  })

  it('no autosave without edit rights; flush with nothing dirty does nothing', async () => {
    const { result } = mount({ canEdit: false })
    await waitFor(() => expect(result.current.state.status).toBe('clean'))
    vi.useFakeTimers()
    act(() => result.current.edit('x'))
    await act(async () => { await vi.advanceTimersByTimeAsync(NOTE_AUTOSAVE_MS * 2) })
    expect(h.putNote).not.toHaveBeenCalled()
    act(() => result.current.edit('hello'))
    await act(async () => { await result.current.flush() })
    expect(h.putNote).not.toHaveBeenCalled()
  })

  it('a failed save shows the mapped error; retry makes it dirty again', async () => {
    const e = new AxiosError('x')
    e.response = { status: 429, data: {} } as AxiosResponse
    h.putNote.mockRejectedValueOnce(e)
    const { result } = mount({ canEdit: false })
    await waitFor(() => expect(result.current.state.status).toBe('clean'))
    act(() => result.current.edit('typed'))
    await act(async () => { await result.current.flush() })
    expect(result.current.state).toMatchObject({ status: 'error', errorKey: { key: 'errRateLimited' }, draft: 'typed' })
    act(() => result.current.retry())
    expect(result.current.state.status).toBe('dirty')
  })

  it('a 409 conflict keeps the draft and offers the latest; keep mine / take theirs / merge', async () => {
    h.putNote.mockRejectedValue(conflict({ scope: 'shared', content: 'theirs', version: 5 }))
    const { result } = mount({ canEdit: false })
    await waitFor(() => expect(result.current.state.status).toBe('clean'))
    act(() => result.current.edit('mine'))
    await act(async () => { await result.current.flush() })
    expect(result.current.state.status).toBe('conflict')
    expect(result.current.state.latest).toMatchObject({ content: 'theirs', version: 5 })
    expect(result.current.state.draft).toBe('mine')
    act(() => result.current.keepMine())
    expect(result.current.state).toMatchObject({ status: 'dirty', baseVersion: 5, draft: 'mine' })
    await act(async () => { await result.current.flush() })
    act(() => result.current.takeTheirs())
    expect(result.current.state.draft).toBe('theirs')
    act(() => result.current.edit('again'))
    await act(async () => { await result.current.flush() })
    act(() => result.current.saveMerged('merged'))
    expect(result.current.state.draft).toBe('merged')
  })

  it('a remote newer version while clean triggers a refetch', async () => {
    const { result, rerender } = mount()
    await waitFor(() => expect(result.current.state.status).toBe('clean'))
    h.getNote.mockResolvedValue(note('remote edit', 4))
    rerender({ remote: { version: 4 } })
    await waitFor(() => expect(result.current.state.draft).toBe('remote edit'))
    expect(h.getNote).toHaveBeenCalledTimes(2)
  })

  it('unmounting with unsaved text saves it', async () => {
    const { result, unmount } = mount({ canEdit: false })
    await waitFor(() => expect(result.current.state.status).toBe('clean'))
    act(() => result.current.edit('unsaved'))
    unmount()
    await waitFor(() => expect(h.putNote).toHaveBeenCalledWith('m1', 'shared', { content: 'unsaved', version: 1 }))
  })

  it('disabled → no load', () => {
    const { result } = mount({ enabled: false })
    expect(h.getNote).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe('loading')
  })
})
