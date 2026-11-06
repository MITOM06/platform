/**
 * Session-level realtime pipeline: connect once on the unauthed → authed
 * transition (never on token rotation), disconnect on logout, durable
 * subscriptions route each queue, a RE-connect (not the first connect) catches
 * the sidebar up by invalidating — and a connect failure shows a localized toast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => {
  const durable = new Map<string, (frame: { body: string }) => void>()
  const stateListeners: Array<(c: boolean) => void> = []
  return {
    durable,
    stateListeners,
    connected: false,
    connect: vi.fn((_token: string) => Promise.resolve()),
    disconnect: vi.fn(),
    offs: [] as Array<ReturnType<typeof vi.fn>>,
    toastError: vi.fn(),
    toastInfo: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    handleUserQueueEvent: vi.fn(),
    parseUserQueueEvent: vi.fn((body: string) => (body === 'bad' ? null : { type: 'X', body })),
    handleMeetingQueueEvent: vi.fn(),
    parseMeetingEvent: vi.fn((body: string) => (body === 'bad' ? null : { type: 'M', body })),
    handleWebRtcFrame: vi.fn(),
    presenceHandle: vi.fn(),
    presenceDispose: vi.fn(),
    refreshCallTransport: vi.fn(),
    refreshClaims: vi.fn(),
    t: (k: string) => `layout.${k}`,
    tChat: (k: string) => `chat.${k}`,
    tMeeting: (k: string) => `meeting.${k}`,
  }
})

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, replace: h.replace }) }))
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (ns: string) => (ns === 'chat' ? h.tChat : ns === 'meeting' ? h.tMeeting : h.t),
}))
vi.mock('sonner', () => ({ toast: { error: h.toastError, info: h.toastInfo } }))
vi.mock('@/lib/hooks/use-ai-threads', () => ({ useAiThreads: () => undefined }))
vi.mock('@/lib/stomp/client', () => ({
  stompService: {
    isConnected: () => h.connected,
    connect: h.connect,
    disconnect: h.disconnect,
    subscribeDurable: vi.fn((dest: string, cb: (frame: { body: string }) => void) => {
      h.durable.set(dest, cb)
      const off = vi.fn(() => h.durable.delete(dest))
      h.offs.push(off)
      return off
    }),
    onStateChange: vi.fn((l: (c: boolean) => void) => {
      h.stateListeners.push(l)
      l(h.connected)
      return () => {
        const i = h.stateListeners.indexOf(l)
        if (i > -1) h.stateListeners.splice(i, 1)
      }
    }),
  },
}))
vi.mock('@/lib/realtime/user-queue', () => ({
  handleUserQueueEvent: h.handleUserQueueEvent,
  parseUserQueueEvent: h.parseUserQueueEvent,
}))
vi.mock('@/lib/realtime/meeting-queue', () => ({ handleMeetingQueueEvent: h.handleMeetingQueueEvent }))
vi.mock('@/lib/meetings/meeting-events', () => ({ parseMeetingEvent: h.parseMeetingEvent }))
vi.mock('@/lib/realtime/session-handlers', () => ({
  handleWebRtcFrame: h.handleWebRtcFrame,
  createPresenceHandler: () => ({ handle: h.presenceHandle, dispose: h.presenceDispose }),
}))
vi.mock('@/lib/realtime/claims', () => ({ refreshClaims: h.refreshClaims }))
vi.mock('@/lib/webrtc/call-transport', () => ({ refreshCallTransport: h.refreshCallTransport }))

import { useRealtimeNotifications } from '@/lib/hooks/use-realtime-notifications'
import { useAuthStore } from '@/lib/store/auth.store'
import { AI_THREADS_KEY, CONVERSATIONS_KEY } from '@/lib/realtime/conversation-cache'

const USER = { id: 'u1', email: 'a@b.c', displayName: 'A' }
let qc: QueryClient

function render() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return renderHook(() => useRealtimeNotifications(), { wrapper })
}

function setConnected(c: boolean) {
  h.connected = c
  act(() => {
    h.stateListeners.slice().forEach((l) => l(c))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.durable.clear()
  h.stateListeners.length = 0
  h.offs.length = 0
  h.connected = false
  h.connect.mockImplementation(() => Promise.resolve())
  qc = new QueryClient()
  useAuthStore.setState({ user: USER, accessToken: 'tok-1' })
})

describe('connection lifecycle', () => {
  it('signed out: no connect, no subscriptions', () => {
    useAuthStore.setState({ user: null, accessToken: null })
    render()
    expect(h.connect).not.toHaveBeenCalled()
    expect(h.durable.size).toBe(0)
  })

  it('connects once with the token; a token rotation does NOT reconnect', () => {
    render()
    expect(h.connect).toHaveBeenCalledTimes(1)
    expect(h.connect).toHaveBeenCalledWith('tok-1')
    act(() => useAuthStore.setState({ accessToken: 'tok-2' }))
    expect(h.connect).toHaveBeenCalledTimes(1)
    expect(h.disconnect).not.toHaveBeenCalled()
  })

  it('does not open a second socket when one is already connected', () => {
    h.connected = true
    render()
    expect(h.connect).not.toHaveBeenCalled()
  })

  it('logout disconnects and drops every durable subscription', () => {
    render()
    expect([...h.durable.keys()].sort()).toEqual([
      '/topic/presence', '/user/queue/meeting', '/user/queue/notifications', '/user/queue/webrtc',
    ])
    act(() => useAuthStore.setState({ user: null, accessToken: null }))
    expect(h.disconnect).toHaveBeenCalled()
    expect(h.durable.size).toBe(0)
    h.offs.forEach((off) => expect(off).toHaveBeenCalled())
    expect(h.presenceDispose).toHaveBeenCalled()
  })

  it('a failed connect shows the localized realtime error, never the raw error', async () => {
    h.connect.mockRejectedValue(new Error('ERROR frame: java.lang.IllegalState'))
    render()
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith('layout.realtimeError'))
  })
})

describe('durable subscriptions route each queue', () => {
  it('notifications / meeting / webrtc / presence frames reach their handlers; unparseable ones are dropped', () => {
    render()
    h.durable.get('/user/queue/notifications')!({ body: 'n1' })
    h.durable.get('/user/queue/notifications')!({ body: 'bad' })
    expect(h.handleUserQueueEvent).toHaveBeenCalledTimes(1)
    const [event, ctx] = h.handleUserQueueEvent.mock.calls[0]
    expect(event).toEqual({ type: 'X', body: 'n1' })
    expect(ctx).toMatchObject({ queryClient: qc, currentUserId: 'u1' })

    h.durable.get('/user/queue/meeting')!({ body: 'm1' })
    h.durable.get('/user/queue/meeting')!({ body: 'bad' })
    expect(h.handleMeetingQueueEvent).toHaveBeenCalledTimes(1)
    expect(h.handleMeetingQueueEvent.mock.calls[0][1]).toMatchObject({ queryClient: qc, locale: 'en' })

    h.durable.get('/user/queue/webrtc')!({ body: '{"type":"offer"}' })
    expect(h.handleWebRtcFrame).toHaveBeenCalledWith('{"type":"offer"}', h.tChat)

    h.durable.get('/topic/presence')!({ body: '{"userId":"b","online":true}' })
    expect(h.presenceHandle).toHaveBeenCalledWith('{"userId":"b","online":true}')
  })

  it('the user-queue context honours the notification preference and the open conversation', () => {
    render()
    h.durable.get('/user/queue/notifications')!({ body: 'n1' })
    const ctx = h.handleUserQueueEvent.mock.calls[0][1] as {
      notificationsEnabled: () => boolean
      isViewingConversation: (id: string) => boolean
      onRemovedFromConversation: (id: string) => void
      onClaimsChanged: () => void
    }
    expect(typeof ctx.notificationsEnabled()).toBe('boolean')
    expect(ctx.isViewingConversation('c1')).toBe(window.location.pathname === '/conversations/c1')

    // Removed from a chat I'm not looking at → silent.
    ctx.onRemovedFromConversation('elsewhere')
    expect(h.replace).not.toHaveBeenCalled()

    window.history.pushState({}, '', '/conversations/c1')
    ctx.onRemovedFromConversation('c1')
    expect(h.toastInfo).toHaveBeenCalledWith('chat.removedFromConversation', { id: 'removed-c1' })
    expect(h.replace).toHaveBeenCalledWith('/conversations')
    window.history.pushState({}, '', '/')

    ctx.onClaimsChanged()
    expect(h.refreshClaims).toHaveBeenCalledWith(qc)
  })
})

describe('reconnect catch-up', () => {
  it('the FIRST connect does not invalidate; a re-connect after a drop does', async () => {
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    render()
    setConnected(true) // first connect
    expect(invalidate).not.toHaveBeenCalled()
    await waitFor(() => expect(h.refreshCallTransport).toHaveBeenCalledTimes(1))

    setConnected(false)
    setConnected(true) // reconnect
    expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toEqual([
      CONVERSATIONS_KEY,
      AI_THREADS_KEY,
      ['notifications'],
    ])
    await waitFor(() => expect(h.refreshCallTransport).toHaveBeenCalledTimes(2))
  })

  it('already connected at mount: refresh the call transport now, and a later drop+reconnect catches up', async () => {
    h.connected = true
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    render()
    await waitFor(() => expect(h.refreshCallTransport).toHaveBeenCalled())
    setConnected(false)
    setConnected(true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: CONVERSATIONS_KEY })
  })
})
