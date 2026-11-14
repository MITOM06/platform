import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'

const apis = vi.hoisted(() => {
  const m = () => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() })
  return { chatApi: m(), authApi: m(), aiApi: m(), connectorApi: m() }
})
vi.mock('@/lib/api/axios', () => apis)

import { aiService } from '@/lib/api/ai'
import { aiActionsService } from '@/lib/api/ai-actions'
import { reminderService } from '@/lib/api/reminders'
import { usageService } from '@/lib/api/usage'
import { callsApi } from '@/lib/api/calls'
import { kbService } from '@/lib/api/kb'
import { notificationsApi } from '@/lib/api/notifications'
import { friendsService } from '@/lib/api/friends'
import { botAdminService, botAdminErrorKey } from '@/lib/api/bot-admin'
import { meetingsApi } from '@/lib/api/meetings'

beforeEach(() => {
  for (const api of Object.values(apis)) for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue({ data: 'D' })
})

const httpErr = (status: number, data?: unknown) => {
  const e = new AxiosError('fail')
  e.response = { status, data } as AxiosResponse
  return e
}

describe('aiService', () => {
  it('getTokenUsage defaults to 30 days', async () => {
    await expect(aiService.getTokenUsage()).resolves.toBe('D')
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/usage/tokens', { params: { days: 30 } })
    await aiService.getTokenUsage(7)
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/usage/tokens', { params: { days: 7 } })
  })
  it('memory routes', async () => {
    await expect(aiService.getMyMemories()).resolves.toBe('D')
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/ai/memories')
    await expect(aiService.getConversationMemory('c1')).resolves.toBe('D')
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/ai/memories/c1')
    await aiService.deleteMemory('c1')
    expect(apis.chatApi.delete).toHaveBeenLastCalledWith('/api/ai/memories/c1')
  })
  it('getPersona returns null on 404 and rethrows other errors', async () => {
    await expect(aiService.getPersona('c1')).resolves.toBe('D')
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/conversations/c1/ai-persona')
    apis.chatApi.get.mockRejectedValueOnce(httpErr(404))
    await expect(aiService.getPersona('c1')).resolves.toBeNull()
    const e500 = httpErr(500)
    apis.chatApi.get.mockRejectedValueOnce(e500)
    await expect(aiService.getPersona('c1')).rejects.toBe(e500)
  })
  it('upsert / delete persona', async () => {
    const body = { name: 'N', tone: 'calm' }
    await expect(aiService.upsertPersona('c1', body)).resolves.toBe('D')
    expect(apis.chatApi.put).toHaveBeenLastCalledWith('/api/conversations/c1/ai-persona', body)
    await aiService.deletePersona('c1')
    expect(apis.chatApi.delete).toHaveBeenLastCalledWith('/api/conversations/c1/ai-persona')
  })
})

describe('small chat / ai clients', () => {
  it('aiActionsService encodes the id for confirm and cancel', async () => {
    await expect(aiActionsService.confirm('a/1')).resolves.toBe('D')
    expect(apis.aiApi.post).toHaveBeenLastCalledWith('/ai/actions/a%2F1/confirm')
    await expect(aiActionsService.cancel('a/1')).resolves.toBe('D')
    expect(apis.aiApi.post).toHaveBeenLastCalledWith('/ai/actions/a%2F1/cancel')
  })
  it('reminderService', async () => {
    await expect(reminderService.getReminders()).resolves.toBe('D')
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/reminders')
    await expect(reminderService.markDone('r1')).resolves.toBe('D')
    expect(apis.chatApi.patch).toHaveBeenLastCalledWith('/api/reminders/r1/done')
    await reminderService.deleteReminder('r1')
    expect(apis.chatApi.delete).toHaveBeenLastCalledWith('/api/reminders/r1')
  })
  it('usageService', async () => {
    await expect(usageService.getQuota()).resolves.toBe('D')
    expect(apis.aiApi.get).toHaveBeenLastCalledWith('/usage/quota')
    await usageService.getDashboard()
    expect(apis.aiApi.get).toHaveBeenLastCalledWith('/usage/dashboard', { params: {} })
    await usageService.getDashboard({ month: '2026-10' })
    expect(apis.aiApi.get).toHaveBeenLastCalledWith('/usage/dashboard', { params: { month: '2026-10' } })
  })
  it('callsApi', async () => {
    await expect(callsApi.getConfig()).resolves.toBe('D')
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/calls/config')
    await expect(callsApi.getToken('c 1')).resolves.toBe('D')
    expect(apis.chatApi.post).toHaveBeenLastCalledWith('/api/calls/c%201/token')
  })
  it('kbService', async () => {
    await expect(kbService.getDocuments('c1')).resolves.toBe('D')
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/kb/documents', { params: { conversationId: 'c1' } })
    const doc = { conversationId: 'c1', fileUrl: 'u', fileName: 'f', mimeType: 'm' }
    await expect(kbService.uploadDocument(doc)).resolves.toBe('D')
    expect(apis.chatApi.post).toHaveBeenLastCalledWith('/api/kb/documents', doc)
    await kbService.deleteDocument('d1')
    expect(apis.chatApi.delete).toHaveBeenLastCalledWith('/api/kb/documents/d1')
  })
  it('notificationsApi', async () => {
    await expect(notificationsApi.list()).resolves.toBe('D')
    apis.authApi.get.mockResolvedValueOnce({ data: { count: 4 } })
    await expect(notificationsApi.unreadCount()).resolves.toBe(4)
    expect(apis.authApi.get).toHaveBeenLastCalledWith('/api/notifications/unread-count')
    await notificationsApi.markRead('n1')
    expect(apis.authApi.post).toHaveBeenLastCalledWith('/api/notifications/n1/read')
    await notificationsApi.markAllRead()
    expect(apis.authApi.post).toHaveBeenLastCalledWith('/api/notifications/read-all')
  })
})

describe('friendsService', () => {
  it('listFriends coerces non-arrays', async () => {
    apis.authApi.get.mockResolvedValueOnce({ data: [{ id: 'u' }] })
    await expect(friendsService.listFriends()).resolves.toEqual([{ id: 'u' }])
    apis.authApi.get.mockResolvedValueOnce({ data: '<html>' })
    await expect(friendsService.listFriends()).resolves.toEqual([])
  })
  it('listRequests maps to requesters and drops empty ones', async () => {
    apis.authApi.get.mockResolvedValueOnce({
      data: [{ friendshipId: 'f1', requester: { id: 'u1' } }, { friendshipId: 'f2', requester: null }],
    })
    await expect(friendsService.listRequests()).resolves.toEqual([{ id: 'u1' }])
    apis.authApi.get.mockResolvedValueOnce({ data: { error: 1 } })
    await expect(friendsService.listRequests()).resolves.toEqual([])
  })
  it('mutations hit the right routes', async () => {
    await expect(friendsService.sendRequest('u1')).resolves.toBe('D')
    expect(apis.authApi.post).toHaveBeenLastCalledWith('/api/friends/request', { recipientId: 'u1' })
    await friendsService.acceptRequest('u2')
    expect(apis.authApi.put).toHaveBeenLastCalledWith('/api/friends/accept', { requesterId: 'u2' })
    await friendsService.removeFriend('u3')
    expect(apis.authApi.delete).toHaveBeenLastCalledWith('/api/friends/u3')
    await expect(friendsService.getStatus('u4')).resolves.toBe('D')
    expect(apis.authApi.get).toHaveBeenLastCalledWith('/api/friends/status/u4')
  })
})

describe('botAdminService', () => {
  it('issue / revoke / listSessions / listExternalBots', async () => {
    await expect(botAdminService.issue('u', 'b')).resolves.toBe('D')
    expect(apis.connectorApi.post).toHaveBeenLastCalledWith('/api/bot/sessions', { userId: 'u', botUserId: 'b' })
    await expect(botAdminService.revoke('u', 'b')).resolves.toBeUndefined()
    expect(apis.connectorApi.delete).toHaveBeenLastCalledWith('/api/bot/sessions', { data: { userId: 'u', botUserId: 'b' } })
    apis.connectorApi.get.mockResolvedValueOnce({ data: { sessions: [{ botUserId: 'b' }] } })
    await expect(botAdminService.listSessions('u')).resolves.toEqual([{ botUserId: 'b' }])
    expect(apis.connectorApi.get).toHaveBeenLastCalledWith('/api/bot/sessions', { params: { userId: 'u' } })
    apis.connectorApi.get.mockResolvedValueOnce({ data: '<html>' })
    await expect(botAdminService.listSessions('u')).resolves.toEqual([])
    apis.chatApi.get.mockResolvedValueOnce({ data: [{ id: 'x' }] })
    await expect(botAdminService.listExternalBots()).resolves.toEqual([{ id: 'x' }])
    apis.chatApi.get.mockResolvedValueOnce({ data: null })
    await expect(botAdminService.listExternalBots()).resolves.toEqual([])
  })
  it('botAdminErrorKey maps codes', () => {
    expect(botAdminErrorKey(new Error('offline'))).toBe('errNetwork')
    expect(botAdminErrorKey(null)).toBe('errNetwork')
    expect(botAdminErrorKey(httpErr(403, { code: 'INSUFFICIENT_PERMISSION' }))).toBe('errInsufficientPermission')
    expect(botAdminErrorKey(httpErr(409, { code: 'BOT_OWNER_MISMATCH' }))).toBe('errBotOwnerMismatch')
    expect(botAdminErrorKey(httpErr(400, { code: 'WHATEVER' }))).toBe('errGeneric')
    expect(botAdminErrorKey(httpErr(500))).toBe('errGeneric')
  })
})

describe('meetingsApi remaining routes', () => {
  it('get / create / update / summary / regenerate / admit / deny', async () => {
    await expect(meetingsApi.get('m 1')).resolves.toBe('D')
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/meetings/m%201')
    await meetingsApi.create()
    expect(apis.chatApi.post).toHaveBeenLastCalledWith('/api/meetings', {})
    await meetingsApi.update('m1', { title: 'T' } as never)
    expect(apis.chatApi.patch).toHaveBeenLastCalledWith('/api/meetings/m1', { title: 'T' })
    await expect(meetingsApi.summary('m1')).resolves.toBe('D')
    expect(apis.chatApi.get).toHaveBeenLastCalledWith('/api/meetings/m1/summary')
    await expect(meetingsApi.regenerateSummary('m1')).resolves.toBe('D')
    expect(apis.chatApi.post).toHaveBeenLastCalledWith('/api/meetings/m1/summary/regenerate')
    await expect(meetingsApi.admit('m1', 'u/1')).resolves.toBeUndefined()
    expect(apis.chatApi.post).toHaveBeenLastCalledWith('/api/meetings/m1/lobby/u%2F1/admit')
    await expect(meetingsApi.deny('m1', 'u1')).resolves.toBeUndefined()
    expect(apis.chatApi.post).toHaveBeenLastCalledWith('/api/meetings/m1/lobby/u1/deny')
  })
  it('uploadScreenFrame accepts any status', async () => {
    await meetingsApi.uploadScreenFrame('m1', new Blob(['x']), 1)
    const cfg = apis.chatApi.post.mock.calls.at(-1)![2] as { validateStatus: (s: number) => boolean }
    expect(cfg.validateStatus(500)).toBe(true)
    expect(cfg.validateStatus(204)).toBe(true)
  })
})
