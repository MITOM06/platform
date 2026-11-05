import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { chatApi } from '@/lib/api/axios'
import { aiThreadsApi } from '@/lib/api/ai-threads'
import { chatService } from '@/lib/api/chat'
import type { Conversation } from '@/lib/api/types'

interface Call { method?: string; url?: string; data?: unknown; params?: Record<string, unknown> }
let calls: Call[] = []
let saved: unknown
const thread = { id: 't1' } as Conversation

beforeEach(() => {
  calls = []
  saved = chatApi.defaults.adapter
  chatApi.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    calls.push({
      method: config.method,
      url: config.url,
      data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
      params: config.params,
    })
    const data = config.url === '/api/ai-threads' && config.method === 'get'
      ? [thread]
      : config.url === '/api/conversations'
        ? { content: [], page: 0, size: 100, totalElements: 0, hasNext: false }
        : thread
    return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse)
  }
})
afterEach(() => {
  chatApi.defaults.adapter = saved as typeof chatApi.defaults.adapter
})

describe('aiThreadsApi', () => {
  it('list GETs /api/ai-threads', async () => {
    expect(await aiThreadsApi.list()).toEqual([thread])
    expect(calls[0]).toMatchObject({ method: 'get', url: '/api/ai-threads' })
  })
  it('create POSTs /api/ai-threads', async () => {
    expect(await aiThreadsApi.create()).toEqual(thread)
    expect(calls[0]).toMatchObject({ method: 'post', url: '/api/ai-threads' })
  })
  it('rename PATCHes /api/ai-threads/{id} with name', async () => {
    await aiThreadsApi.rename('t1', 'Hello')
    expect(calls[0]).toMatchObject({ method: 'patch', url: '/api/ai-threads/t1', data: { name: 'Hello' } })
  })
})

describe('main conversations list', () => {
  it('sends excludeAi=true', async () => {
    await chatService.getConversations()
    expect(calls[0].params).toMatchObject({ excludeAi: true })
  })
})
