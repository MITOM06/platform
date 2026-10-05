/**
 * List + catch-up pagination against chat-service.
 *  - Conversation lists load every page (only page 0 / 20 rows was ever shown).
 *  - Reconnect catch-up loops 50-row pages with the last row's createdAt + id as
 *    the cursor until `hasNext` is false (a busy hour offline lost all past 50).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { chatApi } from '@/lib/api/axios'
import { chatService } from '@/lib/api/chat'
import type { Conversation, Message } from '@/lib/api/types'

type Params = Record<string, string | number | boolean | undefined>
let calls: Params[] = []
let savedAdapter: unknown

function respond(config: InternalAxiosRequestConfig, data: unknown): Promise<AxiosResponse> {
  return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse)
}

function useAdapter(fn: (params: Params) => unknown) {
  chatApi.defaults.adapter = (config: InternalAxiosRequestConfig) => {
    const params = (config.params ?? {}) as Params
    calls.push(params)
    return respond(config, fn(params))
  }
}

const conv = (id: string) => ({ id }) as Conversation
const msg = (id: string, createdAt: string) =>
  ({ id, createdAt, conversationId: 'c1', senderId: 'u', content: id, type: 'text' }) as Message

beforeEach(() => {
  calls = []
  savedAdapter = chatApi.defaults.adapter
})
afterEach(() => {
  chatApi.defaults.adapter = savedAdapter as typeof chatApi.defaults.adapter
})

describe('chatService pagination', () => {
  it('loads every conversation page (size 100) and de-dupes rows', async () => {
    useAdapter((p) =>
      p.page === 0
        ? { content: [conv('a'), conv('b')], page: 0, size: 100, totalElements: 3, hasNext: true }
        : { content: [conv('b'), conv('c')], page: 1, size: 100, totalElements: 3, hasNext: false },
    )
    const res = await chatService.getConversations(true)
    expect(res.content.map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(calls).toEqual([
      { archived: true, page: 0, size: 100 },
      { archived: true, page: 1, size: 100 },
    ])
  })

  it('catch-up loops with after + afterId until hasNext is false', async () => {
    useAdapter((p) => {
      if (p.afterId === undefined) {
        return { content: [msg('m1', 't1'), msg('m2', 't2')], hasNext: true }
      }
      if (p.afterId === 'm2') return { content: [msg('m3', 't3')], hasNext: false }
      throw new Error(`unexpected cursor ${String(p.afterId)}`)
    })
    const missed = await chatService.getAllMessagesSince('c1', 't0')
    expect(missed.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(calls).toEqual([{ after: 't0' }, { after: 't2', afterId: 'm2' }])
  })

  it('passes the newest known id as the first-page tiebreaker', async () => {
    useAdapter(() => ({ content: [], hasNext: false }))
    await chatService.getAllMessagesSince('c1', 't0', 'm0')
    expect(calls).toEqual([{ after: 't0', afterId: 'm0' }])
  })
})
