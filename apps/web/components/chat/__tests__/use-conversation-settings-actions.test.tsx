/** Action handlers + derived flags of useConversationSettings (delete is covered next to the hook). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import { makeQueryWrapper } from '@/test/query-wrapper'
import type { Conversation } from '@/lib/api/types'

const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  chat: {
    sendMessage: vi.fn(), unmuteConversation: vi.fn(), muteConversation: vi.fn(),
    markConversationRead: vi.fn(), markConversationUnread: vi.fn(), archiveConversation: vi.fn(),
    unarchiveConversation: vi.fn(), blockRestoreConversation: vi.fn(), blockArchiveConversation: vi.fn(),
    clearHistory: vi.fn(), deleteConversation: vi.fn(), removeMember: vi.fn(), updateSettings: vi.fn(),
  },
  auth: { blockUser: vi.fn(), unblockUser: vi.fn() },
  relationship: undefined as { iBlocked?: boolean; blockedMe?: boolean } | undefined,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, replace: h.replace }) }))
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/chat', () => ({ chatService: h.chat }))
vi.mock('@/lib/api/auth', () => ({ authService: h.auth }))
vi.mock('@/lib/hooks/use-relationship', () => ({ useRelationship: () => ({ relationship: h.relationship }) }))

import { useConversationSettings } from '@/components/chat/use-conversation-settings'
import { getNickname } from '@/lib/nicknames'
import { getQuickReaction } from '@/lib/quick-reaction'

const BOT = 'ai-bot-000000000000000000000001'
const conv = (over: Partial<Conversation> = {}) =>
  ({ id: 'c1', participants: ['me', 'bob'], type: 'direct', admins: [], ...over }) as Conversation

function setup(conversation = conv()) {
  const { qc, wrapper } = makeQueryWrapper()
  const inv = vi.spyOn(qc, 'invalidateQueries')
  const onClose = vi.fn()
  const r = renderHook(() => useConversationSettings({ conversation, currentUserId: 'me', onClose }), { wrapper })
  return { ...r, qc, inv, onClose }
}

beforeEach(() => {
  for (const f of [...Object.values(h.chat), ...Object.values(h.auth), h.push, h.replace, h.toast.success, h.toast.error]) {
    f.mockReset().mockResolvedValue(undefined)
  }
  h.relationship = undefined
  localStorage.clear()
  vi.stubGlobal('confirm', () => true)
})

describe('derived flags', () => {
  it('direct chat with a human', () => {
    const { result } = setup(conv({ autoDeleteSeconds: 86400 }))
    expect(result.current).toMatchObject({
      isDirect: true, isGroup: false, isAI: false, otherUserId: 'bob', iBlocked: false, blockedMe: false,
      isBlocked: false, canChangeAutoDelete: true, sliderValue: 2,
    })
    expect(result.current.nicknameParticipantIds).toEqual(['me', 'bob'])
    expect(result.current.autoDeleteOptions.map((o) => o.value)).toEqual([0, 3600, 86400, 604800, 2592000])
  })

  it('group: only admins may change auto-delete; unknown value → slider 0', () => {
    const { result } = setup(conv({ type: 'group', participants: ['me', 'bob', BOT], admins: ['bob'], autoDeleteSeconds: 42 }))
    expect(result.current.canChangeAutoDelete).toBe(false)
    expect(result.current.otherUserId).toBeNull()
    expect(result.current.sliderValue).toBe(0)
    expect(result.current.nicknameParticipantIds).toEqual(['me', 'bob'])
  })

  it('AI chat has no other user; relationship drives block flags', () => {
    expect(setup(conv({ participants: ['me', BOT] })).result.current.otherUserId).toBeNull()
    h.relationship = { iBlocked: false, blockedMe: true }
    expect(setup().result.current).toMatchObject({ iBlocked: false, blockedMe: true, isBlocked: true })
    h.relationship = undefined
    expect(setup(conv({ isBlocked: true })).result.current.iBlocked).toBe(true)
  })
})

describe('simple actions via run()', () => {
  it.each([
    ['handleMarkRead', 'markConversationRead', 'markReadSuccess'],
    ['handleMarkUnread', 'markConversationUnread', 'markUnreadSuccess'],
    ['handleArchiveToggle', 'archiveConversation', 'archiveSuccess'],
  ] as const)('%s calls %s, toasts and invalidates', async (handler, svc, ok) => {
    const { result, inv } = setup()
    await act(async () => { await result.current[handler]() })
    expect(h.chat[svc]).toHaveBeenCalledWith('c1')
    expect(h.toast.success).toHaveBeenCalledWith(ok)
    expect(inv.mock.calls.map((c) => c[0])).toEqual([{ queryKey: ['conversations'] }, { queryKey: ['conversation', 'c1'] }])
    expect(result.current.saving).toBe(false)
  })

  it('archived chats unarchive', async () => {
    const { result } = setup(conv({ isArchived: true }))
    await act(async () => { await result.current.handleArchiveToggle() })
    expect(h.chat.unarchiveConversation).toHaveBeenCalledWith('c1')
    expect(h.toast.success).toHaveBeenCalledWith('unarchiveSuccess')
  })

  it('failures toast a mapped message (403 group admin) and still reset saving', async () => {
    const e = new AxiosError('x')
    e.response = { status: 403, data: { code: 'GROUP_ADMIN_REQUIRED' } } as AxiosResponse
    h.chat.markConversationRead.mockRejectedValue(e)
    const { result, inv } = setup()
    await act(async () => { await result.current.handleMarkRead() })
    expect(h.toast.error).toHaveBeenCalledWith('errGroupAdminRequired')
    expect(inv).not.toHaveBeenCalled()
    expect(result.current.saving).toBe(false)
    h.chat.markConversationRead.mockRejectedValue(new Error('boom'))
    await act(async () => { await result.current.handleMarkRead() })
    expect(h.toast.error).toHaveBeenLastCalledWith('actionError')
  })
})

describe('mute', () => {
  it('unmuted: toggle opens the duration picker; choosing mutes', async () => {
    const { result } = setup()
    act(() => result.current.handleMuteToggle())
    expect(result.current.muteDurationOpen).toBe(true)
    await act(async () => { result.current.handleMuteWithDuration(3600) })
    expect(result.current.muteDurationOpen).toBe(false)
    expect(h.chat.muteConversation).toHaveBeenCalledWith('c1', 3600)
    expect(h.toast.success).toHaveBeenCalledWith('muteSuccess')
  })

  it('muted: toggle unmutes directly', async () => {
    const { result } = setup(conv({ isMuted: true }))
    await act(async () => { result.current.handleMuteToggle() })
    expect(h.chat.unmuteConversation).toHaveBeenCalledWith('c1')
    expect(result.current.muteDurationOpen).toBe(false)
  })
})

describe('nickname / quick reaction', () => {
  it('saveNickname stores locally and broadcasts a trimmed system message', async () => {
    const { result } = setup()
    await act(async () => { await result.current.saveNickname('bob', '  Bobby ') })
    expect(getNickname('c1', 'bob')).toBeTruthy()
    expect(h.chat.sendMessage).toHaveBeenCalledWith('c1', expect.stringContaining('bob:Bobby'), 'system')
    expect(h.toast.success).toHaveBeenCalledWith('nicknameSuccess')
  })

  it('broadcast failures are swallowed for both', async () => {
    h.chat.sendMessage.mockRejectedValue(new Error('net'))
    const { result } = setup()
    await act(async () => { await result.current.saveNickname('bob', 'B') })
    await act(async () => { await result.current.handlePickQuickReaction('🔥') })
    expect(getQuickReaction('c1')).toBe('🔥')
    expect(h.toast.success.mock.calls.map((c) => c[0])).toEqual(['nicknameSuccess', 'quickReactionSuccess'])
    expect(h.toast.error).not.toHaveBeenCalled()
  })
})

describe('block / unblock', () => {
  it('not blocked: the button asks for confirmation; toggling blocks and archives', async () => {
    const { result, inv } = setup()
    act(() => result.current.handleBlockButtonClick())
    expect(result.current.blockConfirmOpen).toBe(true)
    await act(async () => { await result.current.handleBlockToggle() })
    expect(h.auth.blockUser).toHaveBeenCalledWith('bob')
    expect(h.chat.blockArchiveConversation).toHaveBeenCalledWith('c1')
    expect(h.toast.success).toHaveBeenCalledWith('blockSuccess')
    expect(result.current.iBlocked).toBe(true)
    expect(inv).toHaveBeenCalledWith({ queryKey: ['blocked-conversations'] })
  })

  it('blocked by me: the button unblocks and restores directly', async () => {
    h.relationship = { iBlocked: true, blockedMe: false }
    const { result } = setup()
    await act(async () => { result.current.handleBlockButtonClick() })
    expect(h.auth.unblockUser).toHaveBeenCalledWith('bob')
    expect(h.chat.blockRestoreConversation).toHaveBeenCalledWith('c1')
    expect(h.toast.success).toHaveBeenCalledWith('unblockSuccess')
    expect(result.current.iBlocked).toBe(false)
  })

  it('blocked by them: neither confirm nor block', async () => {
    h.relationship = { iBlocked: false, blockedMe: true }
    const { result } = setup()
    act(() => result.current.handleBlockButtonClick())
    expect(result.current.blockConfirmOpen).toBe(false)
    await act(async () => { await result.current.handleBlockToggle() })
    expect(h.auth.blockUser).not.toHaveBeenCalled()
  })

  it('no other user (AI chat) → no-op; API failure → error toast', async () => {
    const ai = setup(conv({ participants: ['me', BOT] }))
    await act(async () => { await ai.result.current.handleBlockToggle() })
    expect(h.auth.blockUser).not.toHaveBeenCalled()
    h.auth.blockUser.mockRejectedValue(new Error('x'))
    const { result } = setup()
    await act(async () => { await result.current.handleBlockToggle() })
    expect(h.toast.error).toHaveBeenCalledWith('actionError')
    expect(result.current.iBlocked).toBe(false)
    expect(result.current.saving).toBe(false)
  })
})

describe('history / delete / leave / auto-delete', () => {
  it('clear history drops cached messages and closes the confirm', async () => {
    const { result, qc } = setup()
    qc.setQueryData(['messages', 'c1'], { pages: [] })
    act(() => result.current.setConfirmClearOpen(true))
    await act(async () => { await result.current.handleClearHistory() })
    expect(h.chat.clearHistory).toHaveBeenCalledWith('c1')
    expect(qc.getQueryData(['messages', 'c1'])).toBeUndefined()
    expect(result.current.confirmClearOpen).toBe(false)
  })

  it('delete of a normal chat goes back to /conversations; cancelled confirm does nothing', async () => {
    const { result, onClose } = setup()
    await act(async () => { await result.current.handleDelete() })
    expect(h.chat.deleteConversation).toHaveBeenCalledWith('c1')
    expect(onClose).toHaveBeenCalled()
    expect(h.push).toHaveBeenCalledWith('/conversations')
    vi.stubGlobal('confirm', () => false)
    h.chat.deleteConversation.mockClear()
    await act(async () => { await result.current.handleDelete() })
    expect(h.chat.deleteConversation).not.toHaveBeenCalled()
  })

  it('leave group removes me and navigates; cancelled confirm does nothing', async () => {
    const { result, onClose } = setup(conv({ type: 'group' }))
    await act(async () => { await result.current.handleLeaveGroup() })
    expect(h.chat.removeMember).toHaveBeenCalledWith('c1', 'me')
    expect(onClose).toHaveBeenCalled()
    expect(h.push).toHaveBeenCalledWith('/conversations')
    expect(h.toast.success).toHaveBeenCalledWith('leaveSuccess')
    vi.stubGlobal('confirm', () => false)
    h.chat.removeMember.mockClear()
    await act(async () => { await result.current.handleLeaveGroup() })
    expect(h.chat.removeMember).not.toHaveBeenCalled()
  })

  it('auto-delete sends seconds, null for off / out-of-range', async () => {
    const { result } = setup()
    await act(async () => { await result.current.handleAutoDelete(3) })
    expect(h.chat.updateSettings).toHaveBeenLastCalledWith('c1', 604800)
    await act(async () => { await result.current.handleAutoDelete(0) })
    expect(h.chat.updateSettings).toHaveBeenLastCalledWith('c1', null)
    await act(async () => { await result.current.handleAutoDelete(99) })
    expect(h.chat.updateSettings).toHaveBeenLastCalledWith('c1', null)
    expect(h.toast.success).toHaveBeenCalledWith('autoDeleteSuccess')
  })

  it('UI toggles flip their state', () => {
    const { result } = setup()
    act(() => { result.current.setWallpaperOpen(true); result.current.setMuteDurationOpen(true) })
    expect(result.current.wallpaperOpen).toBe(true)
    expect(result.current.muteDurationOpen).toBe(true)
  })
})
