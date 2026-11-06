/**
 * useConversationStomp — every STOMP frame on a thread patches the TanStack Query
 * cache (never refetches the thread), AI errors surface as localized keys only,
 * typing ignores myself, catch-up after (re)connect reconciles, read receipts
 * are published once per foreign message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Message } from '@/lib/api/types'

const h = vi.hoisted(() => {
  const handlers = new Map<string, (frame: { body: string }) => void>()
  const unsubs: Array<ReturnType<typeof vi.fn>> = []
  return {
    handlers,
    unsubs,
    connected: true,
    waitForConnect: vi.fn(() => Promise.resolve()),
    publish: vi.fn(),
    replace: vi.fn(),
    t: (k: string) => k,
    router: {} as { replace?: unknown },
    toastInfo: vi.fn(),
    toastError: vi.fn(),
    cache: {
      patchMessage: vi.fn(),
      recallMessage: vi.fn(),
      markMessageRead: vi.fn(),
      attachAiSources: vi.fn(() => true),
      appendMessage: vi.fn(),
      reconcileMessages: vi.fn(),
    },
    ai: {
      streams: [] as unknown[],
      handleEvent: vi.fn(() => false),
      finishReply: vi.fn(),
      startLocal: vi.fn(),
      dropLocal: vi.fn(),
    },
    chat: {
      getAllMessagesSince: vi.fn(() => Promise.resolve([] as Message[])),
      getMessages: vi.fn(() => Promise.resolve({ content: [] as Message[] })),
      markConversationRead: vi.fn(() => Promise.resolve()),
    },
    applyShared: vi.fn(() => 'merged' as string),
    applyNick: vi.fn(),
    applyQuick: vi.fn(),
    groupCallId: null as string | null,
    callManager: { handleCallEvent: vi.fn() },
    groupCallManager: { confirmStarted: vi.fn(), applyRoster: vi.fn(), handleEnded: vi.fn() },
  }
})

// Stable identities, like the real next-intl / next router.
vi.mock('next/navigation', () => ({ useRouter: () => Object.assign(h.router, { replace: h.replace }) }))
vi.mock('next-intl', () => ({ useTranslations: () => h.t }))
vi.mock('sonner', () => ({ toast: { info: h.toastInfo, error: h.toastError } }))
vi.mock('@/lib/stomp/use-stomp-connected', () => ({ useStompConnected: () => h.connected }))
vi.mock('@/lib/stomp/client', () => ({
  stompService: {
    waitForConnect: h.waitForConnect,
    publish: h.publish,
    subscribe: vi.fn((dest: string, cb: (frame: { body: string }) => void) => {
      h.handlers.set(dest, cb)
      const unsubscribe = vi.fn()
      h.unsubs.push(unsubscribe)
      return { unsubscribe }
    }),
  },
}))
vi.mock('@/lib/api/chat', () => ({ chatService: h.chat }))
vi.mock('@/lib/hooks/use-message-cache', () => ({ useMessageCache: () => h.cache }))
vi.mock('@/lib/hooks/use-ai-streams', () => ({ useAiStreams: () => h.ai }))
vi.mock('@/lib/realtime/conversation-cache', () => ({ applySharedConversationUpdate: h.applyShared }))
vi.mock('@/lib/nicknames', () => ({ applyNicknameSystemMessage: h.applyNick }))
vi.mock('@/lib/quick-reaction', () => ({ applyQuickReactionSystemMessage: h.applyQuick }))
vi.mock('@/lib/store/call.store', () => ({
  useCallStore: { getState: () => ({ groupCallId: h.groupCallId }) },
}))
vi.mock('@/lib/webrtc/call-manager', () => ({ callManager: h.callManager }))
vi.mock('@/lib/webrtc/group-call-manager', () => ({ groupCallManager: h.groupCallManager }))

import { useConversationStomp } from '@/lib/hooks/use-conversation-stomp'

const CONV = 'c1'
const ME = 'me'

function msg(over: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    conversationId: CONV,
    senderId: 'bob',
    content: 'hi',
    type: 'text',
    createdAt: '2026-11-01T00:00:00Z',
    ...over,
  } as Message
}

let qc: QueryClient

function render(messages: Message[] = [], currentUserId: string | null = ME) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return renderHook(
    (p: { messages: Message[] }) => useConversationStomp({ id: CONV, messages: p.messages, currentUserId: currentUserId ?? undefined }),
    { wrapper, initialProps: { messages } },
  )
}

async function ready() {
  await waitFor(() => expect(h.handlers.has(`/topic/conversation/${CONV}`)).toBe(true))
}

function send(body: unknown, dest = `/topic/conversation/${CONV}`) {
  act(() => {
    h.handlers.get(dest)!({ body: typeof body === 'string' ? body : JSON.stringify(body) })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.handlers.clear()
  h.unsubs.length = 0
  h.connected = true
  h.groupCallId = null
  h.cache.attachAiSources.mockReturnValue(true)
  h.ai.handleEvent.mockReturnValue(false)
  h.applyShared.mockReturnValue('merged')
  h.waitForConnect.mockImplementation(() => Promise.resolve())
  h.chat.getAllMessagesSince.mockImplementation(() => Promise.resolve([]))
  h.chat.getMessages.mockImplementation(() => Promise.resolve({ content: [] }))
  qc = new QueryClient()
})

describe('message events patch the cache', () => {
  it('MESSAGE_UPDATED patches only the fields it carries', async () => {
    render()
    await ready()
    send({ type: 'MESSAGE_UPDATED', messageId: 'm1', content: 'edited', editedAt: '2026-11-02T00:00:00Z' })
    expect(h.cache.patchMessage).toHaveBeenCalledWith('m1', { content: 'edited', editedAt: '2026-11-02T00:00:00Z' })

    // A pending-action status update must NOT mark the message edited.
    const actions = [{ id: 'a1', status: 'approved' }]
    send({ type: 'MESSAGE_UPDATED', messageId: 'm2', pendingActions: actions })
    expect(h.cache.patchMessage).toHaveBeenLastCalledWith('m2', { pendingActions: actions })
  })

  it('recall, read and reaction events go to the matching cache patch', async () => {
    render()
    await ready()
    send({ type: 'MESSAGE_RECALLED', messageId: 'm1' })
    send({ type: 'MESSAGE_READ', messageId: 'm1', readerId: 'bob' })
    send({ type: 'REACTION_UPDATED', messageId: 'm1', reactions: { '👍': ['bob'] } })
    expect(h.cache.recallMessage).toHaveBeenCalledWith('m1')
    expect(h.cache.markMessageRead).toHaveBeenCalledWith('m1', 'bob')
    expect(h.cache.patchMessage).toHaveBeenCalledWith('m1', { reactions: { '👍': ['bob'] } })
  })

  it('pin and KB status invalidate only their own small queries, never the thread', async () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    render()
    await ready()
    send({ type: 'PINNED_MESSAGE' })
    send({ type: 'KB_STATUS_UPDATE' })
    expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      ['conversation', CONV],
      ['kb-documents', CONV],
    ])
  })

  it('CONVERSATION_UPDATED merges; when it says I was removed, toast once and leave', async () => {
    render()
    await ready()
    const conversation = { id: CONV, participants: ['bob'] }
    send({ type: 'CONVERSATION_UPDATED', conversation })
    expect(h.applyShared).toHaveBeenCalledWith(qc, conversation, ME)
    expect(h.replace).not.toHaveBeenCalled()

    h.applyShared.mockReturnValue('removed')
    send({ type: 'CONVERSATION_UPDATED', conversation })
    expect(h.toastInfo).toHaveBeenCalledWith('removedFromConversation', { id: `removed-${CONV}` })
    expect(h.replace).toHaveBeenCalledWith('/conversations')
  })

  it('malformed JSON and frames for another conversation are ignored', async () => {
    render()
    await ready()
    send('{not json')
    send({ id: 'x', senderId: 'bob', content: 'hi', type: 'text', createdAt: 'z', conversationId: 'other' })
    send({ type: 'SOMETHING_NEW', messageId: 'm1' })
    expect(h.cache.appendMessage).not.toHaveBeenCalled()
    expect(h.cache.patchMessage).not.toHaveBeenCalled()
  })
})

describe('AI streaming', () => {
  it('chunk / tool / pending-action events route to the reply bubbles', async () => {
    render()
    await ready()
    for (const type of ['AI_STREAM_CHUNK', 'AI_TOOL_CALL', 'AI_ACTION_PENDING']) {
      send({ type, replyId: 'r1', chunk: 'x' })
    }
    expect(h.ai.handleEvent).toHaveBeenCalledTimes(3)
    expect(h.ai.handleEvent.mock.calls.map(([e]) => (e as { type: string }).type)).toEqual([
      'AI_STREAM_CHUNK', 'AI_TOOL_CALL', 'AI_ACTION_PENDING',
    ])
  })

  it('AI_STREAM_ERROR toasts a localized key only for the asker — never the raw message', async () => {
    render()
    await ready()
    send({ type: 'AI_STREAM_ERROR', replyId: 'r1', code: 'AI_QUOTA_EXCEEDED', error: 'java.lang.Boom at x.y' })
    expect(h.toastError).not.toHaveBeenCalled() // handleEvent said: not my question

    h.ai.handleEvent.mockReturnValue(true)
    send({ type: 'AI_STREAM_ERROR', replyId: 'r1', code: 'AI_QUOTA_EXCEEDED', error: 'java.lang.Boom at x.y' })
    expect(h.toastError).toHaveBeenCalledWith('aiQuotaExceeded')
  })

  it('DONE attaches RAG sources to the cached AI message', async () => {
    render()
    await ready()
    const sources = [{ documentId: 'd1', title: 'Doc' }]
    send({ type: 'AI_STREAM_DONE', replyId: 'r1', sources })
    expect(h.cache.attachAiSources).toHaveBeenCalledWith(sources, 'r1')
    // DONE without sources does not try to attach.
    send({ type: 'AI_STREAM_DONE', replyId: 'r2' })
    expect(h.cache.attachAiSources).toHaveBeenCalledTimes(1)
  })

  it('DONE before the AI message (reorder): sources are stashed and grafted on append, then the bubble finishes', async () => {
    h.cache.attachAiSources.mockReturnValue(false)
    render()
    await ready()
    const sources = [{ documentId: 'd1', title: 'Doc' }]
    send({ type: 'AI_STREAM_DONE', replyId: 'r1', sources })

    send(msg({ id: 'ai1', type: 'ai', senderId: 'ai-bot-1', content: 'answer', aiReplyId: 'r1' } as Partial<Message>))
    expect(h.cache.appendMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'ai1', sources }))
    expect(h.ai.finishReply).toHaveBeenCalledWith('r1')

    // Stash is consumed: a later AI message gets no stale sources.
    send(msg({ id: 'ai2', type: 'ai', senderId: 'ai-bot-1', content: 'again', aiReplyId: 'r1' } as Partial<Message>))
    expect(h.cache.appendMessage.mock.calls[1][0]).not.toHaveProperty('sources')
  })

  it('a server without replyIds stashes under "" and the next AI message takes it', async () => {
    h.cache.attachAiSources.mockReturnValue(false)
    render()
    await ready()
    const sources = [{ documentId: 'd9', title: 'Doc9' }]
    send({ type: 'AI_STREAM_DONE', sources })
    send(msg({ id: 'ai1', type: 'ai', senderId: 'ai-bot-1', content: 'answer' }))
    expect(h.cache.appendMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'ai1', sources }))
    expect(h.ai.finishReply).not.toHaveBeenCalled()
  })
})

describe('message frames', () => {
  it('appends a plain message without touching nickname / quick-reaction state', async () => {
    render()
    await ready()
    send(msg())
    expect(h.cache.appendMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', content: 'hi' }))
    expect(h.applyNick).not.toHaveBeenCalled()
  })

  it('a system message applies nickname + quick-reaction side effects before appending', async () => {
    render()
    await ready()
    send(msg({ type: 'system', senderId: 'system', content: 'system.nickname.changed:bob:Bobby' }))
    expect(h.applyNick).toHaveBeenCalledWith(CONV, 'system.nickname.changed:bob:Bobby')
    expect(h.applyQuick).toHaveBeenCalledWith(CONV, 'system.nickname.changed:bob:Bobby')
    expect(h.cache.appendMessage).toHaveBeenCalledTimes(1)
  })
})

describe('typing', () => {
  it('adds and removes others, de-duplicates, and ignores my own typing', async () => {
    const { result } = render()
    await ready()
    const dest = `/topic/conversation/${CONV}/typing`
    send({ userId: ME, typing: true }, dest)
    expect(result.current.typingUserIds).toEqual([])
    send({ userId: 'bob', typing: true }, dest)
    send({ userId: 'bob', typing: true }, dest)
    send({ userId: 'carol', typing: true }, dest)
    expect(result.current.typingUserIds).toEqual(['bob', 'carol'])
    send({ userId: 'bob', typing: false }, dest)
    expect(result.current.typingUserIds).toEqual(['carol'])
    send('garbage', dest)
    expect(result.current.typingUserIds).toEqual(['carol'])
  })
})

describe('group calls', () => {
  const started = {
    event: 'call.started',
    callId: 'call1',
    conversationId: CONV,
    media: 'video',
    aiNotetaker: true,
    participants: [{ userId: 'bob' }, { userId: 'carol' }],
    startedBy: 'bob',
    transport: 'sfu',
    kind: 'group',
  }

  it('call.started shows the banner; roster updates the count; ended clears it', async () => {
    const { result } = render()
    await ready()
    send(started)
    expect(result.current.activeCall).toEqual({
      callId: 'call1', media: 'video', aiNotetaker: true, joinedCount: 2, transport: 'sfu',
    })
    expect(h.groupCallManager.confirmStarted).not.toHaveBeenCalled()

    send({ event: 'call.roster', callId: 'call1', participants: [{ userId: 'bob' }, { userId: 'carol', leftAt: 'x' }, { userId: 'd' }] })
    expect(result.current.activeCall?.joinedCount).toBe(2)
    // Roster for another call does not touch this banner, and I'm not in it → no applyRoster.
    send({ event: 'call.roster', callId: 'other', participants: [] })
    expect(result.current.activeCall?.joinedCount).toBe(2)
    expect(h.groupCallManager.applyRoster).not.toHaveBeenCalled()

    send({ event: 'call.ended', callId: 'other' })
    expect(result.current.activeCall?.callId).toBe('call1')
    // Let the lazy manager imports of the first event settle before the next frame
    // (back-to-back in-flight imports of the same mocked module are flaky under vitest).
    await waitFor(() => expect(h.groupCallManager.handleEnded).toHaveBeenCalledWith('other'))
    send({ event: 'call.ended', callId: 'call1' })
    expect(result.current.activeCall).toBeNull()
    await waitFor(() => expect(h.groupCallManager.handleEnded).toHaveBeenCalledWith('call1'))
    expect(h.callManager.handleCallEvent).toHaveBeenCalled()
  })

  it('a call I started activates my group-call state without re-joining', async () => {
    render()
    await ready()
    send({ ...started, startedBy: ME })
    await waitFor(() =>
      expect(h.groupCallManager.confirmStarted).toHaveBeenCalledWith('call1', CONV, ME, 'video', true, 'sfu'),
    )
  })

  it('a 1-on-1 SFU call goes to the call manager, not the group banner', async () => {
    const { result } = render()
    await ready()
    send({ ...started, kind: 'direct' })
    expect(result.current.activeCall).toBeNull()
    await waitFor(() => expect(h.callManager.handleCallEvent).toHaveBeenCalledWith(expect.objectContaining({ callId: 'call1' })))
  })

  it('a roster for the call I am in feeds the group-call manager', async () => {
    h.groupCallId = 'call1'
    render()
    await ready()
    const participants = [{ userId: 'bob' }]
    send({ event: 'call.roster', callId: 'call1', participants })
    await waitFor(() => expect(h.groupCallManager.applyRoster).toHaveBeenCalledWith(participants))
  })
})

describe('connect lifecycle', () => {
  it('does nothing while STOMP is disconnected', async () => {
    h.connected = false
    render([msg()])
    await Promise.resolve()
    expect(h.handlers.size).toBe(0)
    expect(h.chat.getAllMessagesSince).not.toHaveBeenCalled()
  })

  it('catches up after subscribing: backfill since the newest + latest page, reconciled together', async () => {
    const newest = msg({ id: 'm9', createdAt: '2026-11-05T00:00:00Z' })
    const missed = [msg({ id: 'm10' })]
    const latest = [msg({ id: 'm8' })]
    h.chat.getAllMessagesSince.mockResolvedValue(missed)
    h.chat.getMessages.mockResolvedValue({ content: latest })
    render([msg({ id: 'm1' }), newest])
    await waitFor(() => expect(h.cache.reconcileMessages).toHaveBeenCalledWith([...latest, ...missed]))
    expect(h.chat.getAllMessagesSince).toHaveBeenCalledWith(CONV, '2026-11-05T00:00:00Z', 'm9')
  })

  it('no catch-up for an empty thread; a failed catch-up is swallowed', async () => {
    render([])
    await ready()
    expect(h.chat.getAllMessagesSince).not.toHaveBeenCalled()

    h.chat.getAllMessagesSince.mockRejectedValue(new Error('net'))
    render([msg()])
    await waitFor(() => expect(h.chat.getAllMessagesSince).toHaveBeenCalled())
    await Promise.resolve()
    expect(h.cache.reconcileMessages).not.toHaveBeenCalled()
  })

  it('unmount unsubscribes both topics and drops a late catch-up', async () => {
    let resolveSince!: (m: Message[]) => void
    h.chat.getAllMessagesSince.mockReturnValue(new Promise((r) => { resolveSince = r }))
    const { unmount } = render([msg()])
    await ready()
    unmount()
    expect(h.unsubs).toHaveLength(2)
    h.unsubs.forEach((u) => expect(u).toHaveBeenCalled())
    await act(async () => { resolveSince([msg({ id: 'late' })]) })
    expect(h.cache.reconcileMessages).not.toHaveBeenCalled()
  })

  it('a connect that never succeeds subscribes nothing and does not throw', async () => {
    h.waitForConnect.mockImplementation(() => Promise.reject(new Error('down')))
    render([msg()])
    await act(async () => {})
    expect(h.handlers.size).toBe(0)
  })
})

describe('read receipts', () => {
  it('marks the conversation read on open', () => {
    render()
    expect(h.chat.markConversationRead).toHaveBeenCalledWith(CONV)
  })

  it('publishes chat.read once per foreign, unread message', async () => {
    const messages = [
      msg({ id: 'a', senderId: 'bob' }),
      msg({ id: 'b', senderId: ME }), // mine
      msg({ id: 'c', senderId: 'bob', readBy: [ME] }), // already read
    ]
    const { rerender } = render(messages)
    await waitFor(() => expect(h.publish).toHaveBeenCalledTimes(1))
    expect(h.publish).toHaveBeenCalledWith('/app/chat.read', { conversationId: CONV, messageId: 'a' })

    // A re-render with one new foreign message only publishes that one.
    rerender({ messages: [...messages, msg({ id: 'd', senderId: 'carol' })] })
    await waitFor(() => expect(h.publish).toHaveBeenCalledTimes(2))
    expect(h.publish).toHaveBeenLastCalledWith('/app/chat.read', { conversationId: CONV, messageId: 'd' })
  })

  it('sends no receipts when signed out', async () => {
    render([msg()], null)
    await act(async () => {})
    expect(h.publish).not.toHaveBeenCalled()
  })
})

describe('result', () => {
  it('exposes the AI local-bubble controls', () => {
    const { result } = render()
    result.current.startLocalAiStream()
    result.current.dropLocalAiStream()
    expect(h.ai.startLocal).toHaveBeenCalled()
    expect(h.ai.dropLocal).toHaveBeenCalled()
  })
})
