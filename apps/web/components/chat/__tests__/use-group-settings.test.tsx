/**
 * Group settings actions: blank names are refused, search never offers bots or
 * existing members, leaving needs confirmation, admin / public changes MERGE the
 * server answer into the cache, every failure shows a mapped localized message
 * (never the raw server text), and nickname / quick-reaction stay applied locally
 * even when their broadcast fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import type { Conversation } from '@/lib/api/types'

const h = vi.hoisted(() => ({
  chat: {
    sendMessage: vi.fn(),
    updateGroup: vi.fn(),
    addMembers: vi.fn(),
    removeMember: vi.fn(),
    uploadFile: vi.fn(),
    promoteAdmin: vi.fn(),
    demoteAdmin: vi.fn(),
    setPublicChannel: vi.fn(),
  },
  searchUsers: vi.fn(),
  applyShared: vi.fn(),
  setNickname: vi.fn(),
  setQuickReaction: vi.fn(),
  push: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  t: (k: string, v?: Record<string, unknown>) => (v ? `${k}(${JSON.stringify(v)})` : k),
}))
vi.mock('next-intl', () => ({ useTranslations: () => h.t }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/api/chat', () => ({ chatService: h.chat }))
vi.mock('@/lib/api/auth', () => ({ authService: { searchUsers: h.searchUsers } }))
vi.mock('@/lib/realtime/conversation-cache', () => ({ applySharedConversationUpdate: h.applyShared }))
vi.mock('@/lib/nicknames', async (orig) => ({
  ...(await orig<typeof import('@/lib/nicknames')>()),
  setNickname: h.setNickname,
}))
vi.mock('@/lib/quick-reaction', async (orig) => ({
  ...(await orig<typeof import('@/lib/quick-reaction')>()),
  setQuickReaction: h.setQuickReaction,
}))

import { useGroupSettings } from '@/components/chat/use-group-settings'
import { AI_BOT_ID } from '@/lib/constants'

const ME = 'me'
const conversation = {
  id: 'g1',
  type: 'group',
  name: 'Team',
  participants: [ME, 'bob'],
} as unknown as Conversation

const chatErr = (code: string) =>
  new axios.AxiosError('boom', 'ERR', undefined, null, {
    status: 403, statusText: '', headers: {}, config: {} as never,
    data: { code, message: 'org.springframework.security.AccessDeniedException' },
  })

let qc: QueryClient
let invalidated: unknown[][]
let onClose: ReturnType<typeof vi.fn<() => void>>

function render() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return renderHook(() => useGroupSettings({ conversation, currentUserId: ME, onClose }), { wrapper })
}

const lastError = () => String(h.toast.error.mock.calls.at(-1)?.[0])

beforeEach(() => {
  vi.clearAllMocks()
  qc = new QueryClient()
  invalidated = []
  vi.spyOn(qc, 'invalidateQueries').mockImplementation((f) => {
    invalidated.push((f as { queryKey: unknown[] }).queryKey)
    return Promise.resolve()
  })
  onClose = vi.fn()
  Object.values(h.chat).forEach((fn) => fn.mockResolvedValue({}))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rename', () => {
  it('a blank name is refused without a request', async () => {
    const { result } = render()
    act(() => result.current.setNameValue('   '))
    await act(() => result.current.handleSaveName())
    expect(h.chat.updateGroup).not.toHaveBeenCalled()
  })

  it('saves the trimmed name, refreshes list + thread, leaves edit mode', async () => {
    const { result } = render()
    act(() => {
      result.current.setEditingName(true)
      result.current.setNameValue('  New name ')
    })
    await act(() => result.current.handleSaveName())
    expect(h.chat.updateGroup).toHaveBeenCalledWith('g1', 'New name')
    expect(invalidated).toEqual([['conversations'], ['conversation', 'g1']])
    expect(result.current.editingName).toBe(false)
    expect(result.current.saving).toBe(false)
    expect(h.toast.success).toHaveBeenCalledWith('groupNameSuccess')
  })

  it('a rejected rename shows the mapped error and stays editing', async () => {
    h.chat.updateGroup.mockRejectedValue(chatErr('GROUP_ADMIN_REQUIRED'))
    const { result } = render()
    act(() => {
      result.current.setEditingName(true)
      result.current.setNameValue('X')
    })
    await act(() => result.current.handleSaveName())
    expect(lastError()).toBe('errGroupAdminRequired')
    expect(result.current.editingName).toBe(true)
    expect(result.current.saving).toBe(false)
  })
})

describe('members', () => {
  it('search hides bots, system and current members; blank query clears', async () => {
    h.searchUsers.mockResolvedValue({
      results: [
        { _id: 'bob', displayName: 'Bob' },
        { id: 'amy', displayName: 'Amy' },
        { id: AI_BOT_ID, displayName: 'AI' },
        { id: 'extbot:x', displayName: 'Ext' },
        { displayName: 'No id' },
      ],
    })
    const { result } = render()
    await act(() => result.current.handleSearchUsers('  a  '))
    expect(h.searchUsers).toHaveBeenCalledWith('a')
    expect(result.current.searchResults).toEqual([{ id: 'amy', displayName: 'Amy' }])

    await act(() => result.current.handleSearchUsers('  '))
    expect(result.current.searchResults).toEqual([])
    expect(h.searchUsers).toHaveBeenCalledTimes(1)
  })

  it('a failed search shows no results', async () => {
    h.searchUsers.mockRejectedValue(new Error('x'))
    const { result } = render()
    await act(() => result.current.handleSearchUsers('a'))
    expect(result.current.searchResults).toEqual([])
  })

  it('adds a member by _id or id and resets the search', async () => {
    const { result } = render()
    await act(() => result.current.handleAddMember({ _id: 'amy', displayName: 'Amy' } as never))
    expect(h.chat.addMembers).toHaveBeenCalledWith('g1', ['amy'])
    expect(result.current.searchQuery).toBe('')
    expect(h.toast.success).toHaveBeenCalledWith('groupAddSuccess({"name":"Amy"})')

    await act(() => result.current.handleAddMember({ displayName: 'Nobody' } as never))
    expect(h.chat.addMembers).toHaveBeenCalledTimes(1)
  })

  it('add / remove failures are mapped', async () => {
    h.chat.addMembers.mockRejectedValue(chatErr('USER_BLOCKED'))
    h.chat.removeMember.mockRejectedValue(chatErr('LAST_ADMIN_CANNOT_BE_REMOVED'))
    const { result } = render()
    await act(() => result.current.handleAddMember({ id: 'amy', displayName: 'Amy' } as never))
    expect(lastError()).toBe('errUserBlocked')
    await act(() => result.current.handleRemoveMember('bob'))
    expect(lastError()).toBe('errLastAdminCannotBeRemoved')
    expect(lastError()).not.toContain('springframework')
  })

  it('removes a member', async () => {
    const { result } = render()
    await act(() => result.current.handleRemoveMember('bob'))
    expect(h.chat.removeMember).toHaveBeenCalledWith('g1', 'bob')
    expect(h.toast.success).toHaveBeenCalledWith('groupRemoveSuccess')
  })
})

describe('leave', () => {
  it('cancelled confirmation does nothing', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    const { result } = render()
    await act(() => result.current.handleLeaveGroup())
    expect(h.chat.removeMember).not.toHaveBeenCalled()
  })

  it('confirmed: removes ME, closes and goes home', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const { result } = render()
    await act(() => result.current.handleLeaveGroup())
    expect(h.chat.removeMember).toHaveBeenCalledWith('g1', ME)
    expect(onClose).toHaveBeenCalled()
    expect(h.push).toHaveBeenCalledWith('/')
  })

  it('a failed leave keeps me in the drawer', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    h.chat.removeMember.mockRejectedValue(new Error('net'))
    const { result } = render()
    await act(() => result.current.handleLeaveGroup())
    expect(onClose).not.toHaveBeenCalled()
    expect(lastError()).toBe('groupLeaveError')
  })
})

describe('avatar', () => {
  const ev = (files: File[]) => ({ target: { files } }) as unknown as React.ChangeEvent<HTMLInputElement>

  it('uploads then sets the avatar URL', async () => {
    h.chat.uploadFile.mockResolvedValue({ url: '/api/uploads/av' })
    const { result } = render()
    await act(() => result.current.handleAvatarUpload(ev([new File(['x'], 'a.png')])))
    expect(h.chat.updateGroup).toHaveBeenCalledWith('g1', undefined, '/api/uploads/av')
    expect(h.toast.success).toHaveBeenCalledWith('groupAvatarSuccess')
  })

  it('no file → nothing; upload failure → mapped error, avatar untouched', async () => {
    const { result } = render()
    await act(() => result.current.handleAvatarUpload(ev([])))
    expect(h.chat.uploadFile).not.toHaveBeenCalled()

    h.chat.uploadFile.mockRejectedValue(new Error('FILE_TOO_LARGE'))
    await act(() => result.current.handleAvatarUpload(ev([new File(['x'], 'a.png')])))
    expect(h.chat.updateGroup).not.toHaveBeenCalled()
    expect(lastError()).toBe('groupAvatarError')
  })
})

describe('admins + public channel', () => {
  it('promote / demote merge the server answer into the cache', async () => {
    const updated = { id: 'g1', admins: ['me', 'bob'] }
    h.chat.promoteAdmin.mockResolvedValue(updated)
    const { result } = render()
    await act(() => result.current.handlePromoteAdmin('bob'))
    expect(h.applyShared).toHaveBeenCalledWith(qc, updated, ME)
    expect(h.toast.success).toHaveBeenLastCalledWith('groupMakeAdminSuccess')
    await act(() => result.current.handleDemoteAdmin('bob'))
    expect(h.chat.demoteAdmin).toHaveBeenCalledWith('g1', 'bob')
    expect(h.toast.success).toHaveBeenLastCalledWith('groupRemoveAdminSuccess')
  })

  it('a failed admin change is mapped and does not touch the cache', async () => {
    h.chat.demoteAdmin.mockRejectedValue(chatErr('LAST_ADMIN_CANNOT_BE_REMOVED'))
    const { result } = render()
    await act(() => result.current.handleDemoteAdmin('me'))
    expect(h.applyShared).not.toHaveBeenCalled()
    expect(lastError()).toBe('errLastAdminCannotBeRemoved')
  })

  it('public on / off, and a department group refusing it', async () => {
    const { result } = render()
    await act(() => result.current.handleTogglePublic(true))
    expect(h.toast.success).toHaveBeenLastCalledWith('groupPublicOnSuccess')
    await act(() => result.current.handleTogglePublic(false))
    expect(h.toast.success).toHaveBeenLastCalledWith('groupPublicOffSuccess')

    h.chat.setPublicChannel.mockRejectedValue(chatErr('PUBLIC_DEPARTMENT_CHANNEL_NOT_ALLOWED'))
    await act(() => result.current.handleTogglePublic(true))
    expect(lastError()).toBe('errPublicDepartmentChannel')
  })
})

describe('nickname + quick reaction broadcasts', () => {
  it('nickname: applied locally and broadcast as a system code', async () => {
    const { result } = render()
    await act(() => result.current.saveNickname('bob', '  Bobby '))
    expect(h.setNickname).toHaveBeenCalledWith('g1', 'bob', '  Bobby ')
    expect(h.chat.sendMessage).toHaveBeenCalledWith('g1', 'system.nickname.changed:bob:Bobby', 'system')
    expect(h.toast.success).toHaveBeenCalledWith('nicknameSuccess')
  })

  it('a failed broadcast still keeps the local change and confirms', async () => {
    h.chat.sendMessage.mockRejectedValue(new Error('net'))
    const { result } = render()
    await act(() => result.current.saveNickname('bob', 'B'))
    await act(() => result.current.handlePickQuickReaction('🔥'))
    expect(h.setNickname).toHaveBeenCalled()
    expect(h.setQuickReaction).toHaveBeenCalledWith('g1', '🔥')
    expect(h.chat.sendMessage).toHaveBeenLastCalledWith('g1', 'system.quick_reaction.changed:🔥', 'system')
    expect(h.toast.success).toHaveBeenLastCalledWith('quickReactionSuccess')
    expect(h.toast.error).not.toHaveBeenCalled()
  })
})
