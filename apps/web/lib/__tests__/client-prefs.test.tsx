/**
 * Client-side per-conversation preferences synced via system messages
 * (nicknames, quick reaction), the one-shot notification-permission prompt and
 * the UI store. Parsing is the risky part: a malformed system message or a
 * corrupt localStorage value must never throw or overwrite someone else's entry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  applyNicknameSystemMessage,
  getNickname,
  getNicknames,
  nicknameSystemMessage,
  NICKNAME_EVENT,
  setNickname,
  useNickname,
  useNicknames,
} from '@/lib/nicknames'
import {
  applyQuickReactionSystemMessage,
  DEFAULT_QUICK_REACTION,
  getQuickReaction,
  quickReactionSystemMessage,
  setQuickReaction,
  useQuickReaction,
} from '@/lib/quick-reaction'
import { maybeRequestNotificationPermission } from '@/lib/notifications'
import { SIDEBAR_DEFAULT_WIDTH, useUiStore } from '@/lib/store/ui.store'

beforeEach(() => {
  localStorage.clear()
})

describe('nicknames', () => {
  it('set / get / clear with trimming; clearing removes only that user', () => {
    setNickname('c1', 'bob', '  Bobby  ')
    setNickname('c1', 'amy', 'Ames')
    expect(getNicknames('c1')).toEqual({ bob: 'Bobby', amy: 'Ames' })
    setNickname('c1', 'bob', '   ')
    expect(getNicknames('c1')).toEqual({ amy: 'Ames' })
    expect(getNickname('c1', 'bob')).toBeUndefined()
    expect(getNicknames('other')).toEqual({})
  })

  it('a corrupt stored map reads as empty instead of throwing', () => {
    localStorage.setItem('chat_nicknames_c1', '{broken')
    expect(getNicknames('c1')).toEqual({})
  })

  it('builds and applies the system message; a nickname may contain ":"', () => {
    const msg = nicknameSystemMessage('bob', 'Dr: Who')
    expect(msg).toBe('system.nickname.changed:bob:Dr: Who')
    applyNicknameSystemMessage('c1', msg)
    expect(getNickname('c1', 'bob')).toBe('Dr: Who')
  })

  it('ignores other codes and a payload without a user separator', () => {
    applyNicknameSystemMessage('c1', 'system.theme.changed:x')
    applyNicknameSystemMessage('c1', 'system.nickname.changed:nobody')
    expect(getNicknames('c1')).toEqual({})
  })

  it('an empty nickname in the system message clears it', () => {
    setNickname('c1', 'bob', 'Bobby')
    applyNicknameSystemMessage('c1', 'system.nickname.changed:bob:')
    expect(getNickname('c1', 'bob')).toBeUndefined()
  })

  it('hooks re-read on change events and stop listening on unmount', () => {
    const all = renderHook(() => useNicknames('c1'))
    const one = renderHook(() => useNickname('c1', 'bob'))
    const none = renderHook(() => useNickname('c1'))
    expect(all.result.current).toEqual({})
    act(() => setNickname('c1', 'bob', 'Bobby'))
    expect(all.result.current).toEqual({ bob: 'Bobby' })
    expect(one.result.current).toBe('Bobby')
    expect(none.result.current).toBeUndefined()

    const remove = vi.spyOn(window, 'removeEventListener')
    all.unmount()
    one.unmount()
    expect(remove).toHaveBeenCalledWith(NICKNAME_EVENT, expect.any(Function))
    remove.mockRestore()
  })
})

describe('quick reaction', () => {
  it('defaults to 👍, stores trimmed values, blank resets to default', () => {
    expect(getQuickReaction('c1')).toBe(DEFAULT_QUICK_REACTION)
    setQuickReaction('c1', ' ❤️ ')
    expect(getQuickReaction('c1')).toBe('❤️')
    setQuickReaction('c1', '  ')
    expect(getQuickReaction('c1')).toBe('👍')
  })

  it('applies only its own system code with a non-empty emoji', () => {
    applyQuickReactionSystemMessage('c1', quickReactionSystemMessage('🔥'))
    expect(getQuickReaction('c1')).toBe('🔥')
    applyQuickReactionSystemMessage('c1', 'system.quick_reaction.changed:')
    expect(getQuickReaction('c1')).toBe('🔥')
    applyQuickReactionSystemMessage('c1', 'system.nickname.changed:bob:x')
    expect(getQuickReaction('c1')).toBe('🔥')
  })

  it('the hook follows changes', () => {
    const { result } = renderHook(() => useQuickReaction('c1'))
    expect(result.current).toBe('👍')
    act(() => setQuickReaction('c1', '😂'))
    expect(result.current).toBe('😂')
  })
})

describe('maybeRequestNotificationPermission', () => {
  const orig = (globalThis as { Notification?: unknown }).Notification
  let request: ReturnType<typeof vi.fn>

  function installNotification(permission: string) {
    request = vi.fn(async () => 'granted')
    ;(globalThis as { Notification?: unknown }).Notification = { permission, requestPermission: request }
  }

  afterEach(() => {
    ;(globalThis as { Notification?: unknown }).Notification = orig
  })

  it('no Notification API → no-op', async () => {
    delete (globalThis as { Notification?: unknown }).Notification
    await expect(maybeRequestNotificationPermission()).resolves.toBeUndefined()
  })

  it('asks exactly once, and remembers it was asked', async () => {
    installNotification('default')
    await maybeRequestNotificationPermission()
    await maybeRequestNotificationPermission()
    expect(request).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('pon_notif_prompted')).toBe('1')
  })

  it('never re-asks once the user decided (granted or denied)', async () => {
    for (const p of ['granted', 'denied']) {
      installNotification(p)
      await maybeRequestNotificationPermission()
      expect(request).not.toHaveBeenCalled()
    }
  })

  it('a browser that throws outside a user gesture is swallowed', async () => {
    installNotification('default')
    request.mockRejectedValue(new Error('gesture'))
    await expect(maybeRequestNotificationPermission()).resolves.toBeUndefined()
  })

  it('still prompts once when localStorage is unavailable (private mode)', async () => {
    installNotification('default')
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    await maybeRequestNotificationPermission()
    expect(request).toHaveBeenCalledTimes(1)
    get.mockRestore()
    set.mockRestore()
  })
})

describe('ui store', () => {
  beforeEach(() => {
    useUiStore.setState({
      showNewChatModal: false,
      defaultChatTab: 'direct',
      showPublicChannelsModal: false,
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
    })
  })

  it('opens the new-chat modal on the requested tab (default direct) and closes it', () => {
    useUiStore.getState().openNewChat('group')
    expect(useUiStore.getState()).toMatchObject({ showNewChatModal: true, defaultChatTab: 'group' })
    useUiStore.getState().closeNewChat()
    useUiStore.getState().openNewChat()
    expect(useUiStore.getState().defaultChatTab).toBe('direct')
  })

  it('public channels modal toggles', () => {
    useUiStore.getState().openPublicChannels()
    expect(useUiStore.getState().showPublicChannelsModal).toBe(true)
    useUiStore.getState().closePublicChannels()
    expect(useUiStore.getState().showPublicChannelsModal).toBe(false)
  })

  it('persists the sidebar width only when asked (not during a live drag)', () => {
    useUiStore.getState().setSidebarWidth(300, false)
    expect(useUiStore.getState().sidebarWidth).toBe(300)
    expect(localStorage.getItem('pon-sidebar-width')).toBeNull()
    useUiStore.getState().setSidebarWidth(320)
    expect(localStorage.getItem('pon-sidebar-width')).toBe('320')
  })
})
