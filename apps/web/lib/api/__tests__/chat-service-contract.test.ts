/**
 * chatService ↔ chat-service REST contract (docs/api-spec.md): method, path and
 * body of every call, plus the upload guard — files over the Cloud Run cap fail
 * fast with FILE_TOO_LARGE (no request), a type-less blob gets a content type
 * from its extension, and the JSON default Content-Type is cleared so axios
 * sends real multipart instead of `{"file":{}}`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { chatApi } from '@/lib/api/axios'
import { chatService, FILE_TOO_LARGE, MAX_UPLOAD_BYTES } from '@/lib/api/chat'

interface Call {
  method: string
  url: string
  data: unknown
  params: unknown
  headers: InternalAxiosRequestConfig['headers']
}
let calls: Call[] = []
let savedAdapter: unknown

beforeEach(() => {
  calls = []
  savedAdapter = chatApi.defaults.adapter
  chatApi.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    calls.push({
      method: (config.method ?? '').toUpperCase(),
      url: config.url ?? '',
      data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      params: config.params,
      headers: config.headers,
    })
    return Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse)
  }
})
afterEach(() => {
  chatApi.defaults.adapter = savedAdapter as typeof chatApi.defaults.adapter
})

type Case = [string, () => Promise<unknown>, string, string, unknown?]

const cases: Case[] = [
  ['getMediaToken', () => chatService.getMediaToken(), 'GET', '/api/uploads/token'],
  ['getConversation', () => chatService.getConversation('c1'), 'GET', '/api/conversations/c1'],
  ['createConversation', () => chatService.createConversation('u2'), 'POST', '/api/conversations', { participantId: 'u2' }],
  ['createGroup (private)', () => chatService.createGroup('G', ['a', 'b']), 'POST', '/api/conversations/group',
    { name: 'G', participantIds: ['a', 'b'], publicChannel: false }],
  ['createGroup (public, department)', () => chatService.createGroup('G', ['a'], true, 'd1'), 'POST', '/api/conversations/group',
    { name: 'G', participantIds: ['a'], publicChannel: true, departmentId: 'd1' }],
  ['promoteAdmin', () => chatService.promoteAdmin('c1', 'u2'), 'POST', '/api/conversations/c1/admins/u2'],
  ['demoteAdmin', () => chatService.demoteAdmin('c1', 'u2'), 'DELETE', '/api/conversations/c1/admins/u2'],
  ['updateGroup', () => chatService.updateGroup('c1', 'N', 'av'), 'PUT', '/api/conversations/c1', { name: 'N', avatarUrl: 'av' }],
  ['setPublicChannel', () => chatService.setPublicChannel('c1', true), 'PUT', '/api/conversations/c1', { publicChannel: true }],
  ['setWallpaper', () => chatService.setWallpaper('c1', ''), 'PUT', '/api/conversations/c1/wallpaper', { wallpaper: '' }],
  ['addMembers', () => chatService.addMembers('c1', ['u3']), 'POST', '/api/conversations/c1/members', { userIds: ['u3'] }],
  ['removeMember', () => chatService.removeMember('c1', 'u3'), 'DELETE', '/api/conversations/c1/members/u3'],
  ['deleteConversation', () => chatService.deleteConversation('c1'), 'DELETE', '/api/conversations/c1'],
  ['clearHistory', () => chatService.clearHistory('c1'), 'POST', '/api/conversations/c1/clear'],
  ['muteConversation (default forever)', () => chatService.muteConversation('c1'), 'POST', '/api/conversations/c1/mute', { durationSeconds: -1 }],
  ['muteConversation (1h)', () => chatService.muteConversation('c1', 3600), 'POST', '/api/conversations/c1/mute', { durationSeconds: 3600 }],
  ['unmuteConversation', () => chatService.unmuteConversation('c1'), 'POST', '/api/conversations/c1/unmute'],
  ['archiveConversation', () => chatService.archiveConversation('c1'), 'POST', '/api/conversations/c1/archive'],
  ['unarchiveConversation', () => chatService.unarchiveConversation('c1'), 'POST', '/api/conversations/c1/unarchive'],
  ['markConversationRead', () => chatService.markConversationRead('c1'), 'POST', '/api/conversations/c1/read'],
  ['markConversationUnread', () => chatService.markConversationUnread('c1'), 'POST', '/api/conversations/c1/unread'],
  ['blockArchiveConversation', () => chatService.blockArchiveConversation('c1'), 'POST', '/api/conversations/c1/block-archive'],
  ['blockRestoreConversation', () => chatService.blockRestoreConversation('c1'), 'POST', '/api/conversations/c1/block-restore'],
  ['acceptConversation', () => chatService.acceptConversation('c1'), 'POST', '/api/conversations/c1/accept'],
  ['updateSettings', () => chatService.updateSettings('c1', null), 'PUT', '/api/conversations/c1/settings', { autoDeleteSeconds: null }],
  ['joinChannel', () => chatService.joinChannel('c1'), 'POST', '/api/conversations/c1/join'],
  ['sendMessage (plain)', () => chatService.sendMessage('c1', 'hi'), 'POST', '/api/messages',
    { conversationId: 'c1', content: 'hi', type: 'text' }],
  ['sendMessage (reply)', () => chatService.sendMessage('c1', 'hi', 'text', 'm0'), 'POST', '/api/messages',
    { conversationId: 'c1', content: 'hi', type: 'text', replyToId: 'm0' }],
  ['editMessage', () => chatService.editMessage('m1', 'x'), 'PUT', '/api/messages/m1', { content: 'x' }],
  ['recallMessage', () => chatService.recallMessage('m1'), 'DELETE', '/api/messages/m1'],
  ['deleteForMe', () => chatService.deleteForMe('m1'), 'POST', '/api/messages/m1/delete-for-me'],
  ['addReaction', () => chatService.addReaction('m1', '👍'), 'POST', '/api/messages/m1/reactions', { emoji: '👍' }],
  ['removeReaction', () => chatService.removeReaction('m1'), 'DELETE', '/api/messages/m1/reactions'],
  ['pinMessage', () => chatService.pinMessage('m1'), 'POST', '/api/messages/m1/pin'],
  ['unpinMessage', () => chatService.unpinMessage('m1'), 'DELETE', '/api/messages/m1/pin'],
  ['forwardMessage', () => chatService.forwardMessage('m1', 'c2'), 'POST', '/api/messages/m1/forward', { targetConversationId: 'c2' }],
  ['getTrace', () => chatService.getTrace('m1'), 'GET', '/api/messages/m1/trace'],
  ['submitFeedback (no comment)', () => chatService.submitFeedback('m1', 'up'), 'POST', '/api/messages/m1/feedback', { rating: 'up' }],
  ['submitFeedback (comment)', () => chatService.submitFeedback('m1', 'down', 'wrong'), 'POST', '/api/messages/m1/feedback',
    { rating: 'down', comment: 'wrong' }],
  ['getUserStatus', () => chatService.getUserStatus('u2'), 'GET', '/api/users/u2/status'],
]

describe('chatService endpoints', () => {
  it.each(cases)('%s', async (_name, call, method, url, body) => {
    await expect(call()).resolves.toBeDefined()
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe(method)
    expect(calls[0].url).toBe(url)
    if (body !== undefined) expect(calls[0].data).toEqual(body)
  })

  it('query-param endpoints', async () => {
    await chatService.listPublicChannels('eng', 2, 10)
    await chatService.getAttachments('c1')
    await chatService.getMessages('c1')
    await chatService.getMessages('c1', 'm5')
    await chatService.fetchLinkPreview('https://example.com')
    await chatService.searchMessages('c1', 'hello')
    expect(calls.map((c) => [c.url, c.params])).toEqual([
      ['/api/conversations/public', { q: 'eng', page: 2, size: 10 }],
      ['/api/conversations/c1/attachments', { type: 'media', page: 0, size: 30 }],
      ['/api/conversations/c1/messages', { size: 30 }],
      ['/api/conversations/c1/messages', { size: 30, before: 'm5' }],
      ['/api/utils/link-preview', { url: 'https://example.com' }],
      ['/api/messages/search', { q: 'hello', conversationId: 'c1' }],
    ])
  })

  it('blocked list asks for blocked=true', async () => {
    chatApi.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      calls.push({ method: 'GET', url: config.url ?? '', data: null, params: config.params, headers: config.headers })
      return Promise.resolve({
        data: { content: [], page: 0, size: 100, totalElements: 0, hasNext: false },
        status: 200, statusText: 'OK', headers: {}, config,
      } as AxiosResponse)
    }
    await chatService.getBlockedConversations()
    expect(calls[0].params).toMatchObject({ blocked: true, page: 0, size: 100 })
  })
})

describe('uploadFile', () => {
  function uploaded(): File {
    const form = calls[0].data as FormData
    return form.get('file') as File
  }

  it('over the cap → rejected with FILE_TOO_LARGE and no request', async () => {
    const big = new File(['x'], 'big.mp4', { type: 'video/mp4' })
    Object.defineProperty(big, 'size', { value: MAX_UPLOAD_BYTES + 1 })
    await expect(chatService.uploadFile(big)).rejects.toThrow(FILE_TOO_LARGE)
    expect(calls).toHaveLength(0)
  })

  it('exactly at the cap is allowed', async () => {
    const edge = new File(['x'], 'edge.png', { type: 'image/png' })
    Object.defineProperty(edge, 'size', { value: MAX_UPLOAD_BYTES })
    await chatService.uploadFile(edge)
    expect(calls).toHaveLength(1)
  })

  it('posts multipart with the JSON Content-Type cleared and the file type kept', async () => {
    await chatService.uploadFile(new File(['x'], 'a.png', { type: 'image/png' }))
    expect(calls[0].url).toBe('/api/uploads')
    expect(calls[0].data).toBeInstanceOf(FormData)
    expect(String(calls[0].headers['Content-Type'] ?? '')).not.toContain('application/json')
    expect(uploaded().name).toBe('a.png')
    expect(uploaded().type).toBe('image/png')
  })

  it.each([
    ['voice.webm', 'video/webm'],
    ['REPORT.PDF', 'application/pdf'],
    ['sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['noext', 'application/octet-stream'],
    ['weird.xyz', 'application/octet-stream'],
  ])('a type-less blob named %s is sent as %s', async (name, type) => {
    await chatService.uploadFile(new Blob(['x']), name)
    expect(uploaded().name).toBe(name)
    expect(uploaded().type).toBe(type)
  })

  it('a nameless blob is uploaded as "file"', async () => {
    await chatService.uploadFile(new Blob(['x'], { type: 'audio/ogg' }))
    expect(uploaded().name).toBe('file')
    expect(uploaded().type).toBe('audio/ogg')
  })
})
