import { describe, it, expect, vi, beforeEach } from 'vitest'

const http = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
}))
const auth = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api/axios', () => ({ chatApi: http, authApi: auth }))

import { meetingsApi } from '@/lib/api/meetings'
import { authService } from '@/lib/api/auth'

beforeEach(() => {
  for (const fn of Object.values(http)) fn.mockReset().mockResolvedValue({ data: undefined })
  auth.get.mockReset().mockResolvedValue({ data: undefined })
})

describe('meetingsApi', () => {
  it('lists a scope with the cursor only when there is one', async () => {
    http.get.mockResolvedValue({ data: { content: [], page: 0, size: 20, totalElements: 0, hasNext: false } })
    await meetingsApi.list('upcoming')
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings', {
      params: { scope: 'upcoming', cursor: undefined, size: 20 },
    })
    await meetingsApi.list('past', 'm9', 50)
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings', {
      params: { scope: 'past', cursor: 'm9', size: 50 },
    })
  })

  it('encodes ids and codes in paths', async () => {
    await meetingsApi.byCode('abc-defg-hjk')
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings/by-code/abc-defg-hjk')
    await meetingsApi.admit('m 1', 'u/2')
    expect(http.post).toHaveBeenLastCalledWith('/api/meetings/m%201/lobby/u%2F2/admit')
  })

  it('leaves the lobby from pagehide with a keepalive fetch and never throws', async () => {
    http.delete.mockRejectedValueOnce(new Error('offline'))
    expect(meetingsApi.leaveLobbyOnExit('m 1')).toBeUndefined()
    expect(http.delete).toHaveBeenLastCalledWith('/api/meetings/m%201/lobby', {
      adapter: 'fetch', fetchOptions: { keepalive: true },
    })
    await Promise.resolve()
  })

  it('creates an instant meeting with an empty body', async () => {
    http.post.mockResolvedValue({ data: { id: 'm1' } })
    await expect(meetingsApi.create()).resolves.toEqual({ id: 'm1' })
    expect(http.post).toHaveBeenLastCalledWith('/api/meetings', {})
  })

  it('pages chat history newest-first with before + size', async () => {
    await meetingsApi.messages('m1', 'msg7')
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings/m1/messages', {
      params: { before: 'msg7', size: 50 },
    })
  })

  it('reads and writes notes by scope', async () => {
    await meetingsApi.getNote('m1', 'private')
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings/m1/notes/private')
    await meetingsApi.putNote('m1', 'shared', { content: '# hi', version: 3 })
    expect(http.put).toHaveBeenLastCalledWith('/api/meetings/m1/notes/shared', { content: '# hi', version: 3 })
  })

  it('unwraps the hands list and tolerates a missing array', async () => {
    http.get.mockResolvedValueOnce({ data: { hands: [{ userId: 'a', raisedAt: 't' }] } })
    await expect(meetingsApi.hands('m1')).resolves.toEqual([{ userId: 'a', raisedAt: 't' }])
    http.get.mockResolvedValueOnce({ data: {} })
    await expect(meetingsApi.hands('m1')).resolves.toEqual([])
  })

  it('reads the waiting room (host/co-host) and tolerates a missing array', async () => {
    http.get.mockResolvedValueOnce({ data: { entries: [{ userId: 'g', displayName: 'Guest' }] } })
    await expect(meetingsApi.lobby('m 1')).resolves.toEqual([{ userId: 'g', displayName: 'Guest' }])
    expect(http.get).toHaveBeenLastCalledWith('/api/meetings/m%201/lobby')
    http.get.mockResolvedValueOnce({ data: {} })
    await expect(meetingsApi.lobby('m1')).resolves.toEqual([])
  })

  it('maps lobby, end and cancel to their routes', async () => {
    await meetingsApi.leaveLobby('m1')
    expect(http.delete).toHaveBeenLastCalledWith('/api/meetings/m1/lobby')
    await meetingsApi.end('m1')
    expect(http.post).toHaveBeenLastCalledWith('/api/meetings/m1/end')
    await meetingsApi.cancel('m1')
    expect(http.delete).toHaveBeenLastCalledWith('/api/meetings/m1')
  })
})

describe('authService.getMyDepartments', () => {
  it('reads the caller departments from auth-service and keeps only well-formed rows', async () => {
    auth.get.mockResolvedValueOnce({ data: [{ id: 'd1', name: 'Sales' }, { id: 'd2' }, { name: 'x' }] })
    await expect(authService.getMyDepartments()).resolves.toEqual([{ id: 'd1', name: 'Sales' }])
    expect(auth.get).toHaveBeenLastCalledWith('/api/users/me/departments')
  })

  it('returns an empty list for a non-array body', async () => {
    auth.get.mockResolvedValueOnce({ data: { nope: true } })
    await expect(authService.getMyDepartments()).resolves.toEqual([])
  })
})
