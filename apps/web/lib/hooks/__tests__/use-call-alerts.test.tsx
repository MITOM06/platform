import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const h = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), { error: vi.fn() })
  return {
    toast,
    user: { data: undefined as { displayName?: string } | undefined },
    nickname: '' as string,
    playTone: vi.fn(),
    stopTone: vi.fn(),
    closeNotif: vi.fn(),
    showNotif: vi.fn(),
    callManager: { onEndNotice: null as null | ((...a: unknown[]) => void) },
    groupCallManager: { onJoinError: null as null | ((k: string) => void) },
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
  }
})
vi.mock('next-intl', () => ({ useTranslations: () => h.t }))
vi.mock('sonner', () => ({ toast: h.toast }))
vi.mock('@/lib/hooks/use-user', () => ({ useUser: () => h.user }))
vi.mock('@/lib/nicknames', () => ({ useNickname: () => h.nickname }))
vi.mock('@/lib/webrtc/call-manager', () => ({ callManager: h.callManager }))
vi.mock('@/lib/webrtc/group-call-manager', () => ({ groupCallManager: h.groupCallManager }))
vi.mock('@/lib/webrtc/call-notification', () => ({ showCallNotification: h.showNotif }))
vi.mock('@/lib/webrtc/call-sounds', async (orig) => ({
  ...(await orig<typeof import('@/lib/webrtc/call-sounds')>()),
  playTone: h.playTone,
  stopTone: h.stopTone,
}))

import { useCallAlerts } from '@/lib/hooks/use-call-alerts'
import { useCallStore } from '@/lib/store/call.store'

const initial = useCallStore.getState()
beforeEach(() => {
  useCallStore.setState(initial, true)
  h.user = { data: undefined }; h.nickname = ''
  for (const f of [h.toast, h.toast.error, h.playTone, h.stopTone, h.closeNotif, h.showNotif]) f.mockReset()
  h.showNotif.mockReturnValue(h.closeNotif)
})

describe('useCallAlerts', () => {
  it('idle: silence, no notification, handlers installed and removed on unmount', () => {
    const { unmount } = renderHook(() => useCallAlerts())
    expect(h.stopTone).toHaveBeenCalled()
    expect(h.playTone).not.toHaveBeenCalled()
    expect(h.showNotif).not.toHaveBeenCalled()
    expect(h.callManager.onEndNotice).toEqual(expect.any(Function))
    expect(h.groupCallManager.onJoinError).toEqual(expect.any(Function))
    unmount()
    expect(h.callManager.onEndNotice).toBeNull()
    expect(h.groupCallManager.onJoinError).toBeNull()
  })

  it('incoming video call: ringtone, OS notification with the resolved name, peer name stored', () => {
    h.user = { data: { displayName: 'Bob' } }
    useCallStore.setState({ status: 'incoming', peerId: 'u2', conversationId: 'c1', video: true, peerName: null } as never)
    const { unmount } = renderHook(() => useCallAlerts())
    expect(h.playTone).toHaveBeenCalledWith('ringtone')
    expect(h.showNotif).toHaveBeenCalledWith('incomingVideo', 'Bob')
    expect(useCallStore.getState().peerName).toBe('Bob')
    unmount()
    expect(h.closeNotif).toHaveBeenCalled()
  })

  it('nickname wins over display name; voice call falls back to peerFallback when unnamed', () => {
    h.nickname = 'Bobby'
    h.user = { data: { displayName: 'Bob' } }
    useCallStore.setState({ status: 'incoming', peerId: 'u2', conversationId: 'c1', video: false, peerName: null } as never)
    renderHook(() => useCallAlerts())
    expect(h.showNotif).toHaveBeenCalledWith('incomingVoice', 'Bobby')
    h.showNotif.mockClear(); h.nickname = ''; h.user = { data: undefined }
    useCallStore.setState({ status: 'incoming', peerId: 'u3', conversationId: 'c2', video: false, peerName: null } as never)
    renderHook(() => useCallAlerts())
    expect(h.showNotif).toHaveBeenCalledWith('incomingVoice', 'peerFallback')
  })

  it('outgoing: ringback, existing peer name kept', () => {
    h.user = { data: { displayName: 'Other' } }
    useCallStore.setState({ status: 'outgoing', peerId: 'u2', conversationId: 'c1', peerName: 'Kept' } as never)
    renderHook(() => useCallAlerts())
    expect(h.playTone).toHaveBeenCalledWith('ringback')
    expect(useCallStore.getState().peerName).toBe('Kept')
  })

  it('end notices: error keys → toast.error, others → plain toast, none → nothing', () => {
    renderHook(() => useCallAlerts())
    act(() => h.callManager.onEndNotice!('declined', true, 'Bob', undefined))
    expect(h.toast).toHaveBeenCalledWith('declined:{"name":"Bob"}')
    act(() => h.callManager.onEndNotice!('hangup', false, '', 'connectionLost'))
    expect(h.toast.error).toHaveBeenCalledWith('connectionLost:{"name":"peerFallback"}')
    h.toast.mockClear(); h.toast.error.mockClear()
    act(() => h.callManager.onEndNotice!('hangup', false, 'Bob', undefined))
    expect(h.toast).not.toHaveBeenCalled()
    expect(h.toast.error).not.toHaveBeenCalled()
  })

  it('group join errors toast the localized key', () => {
    renderHook(() => useCallAlerts())
    act(() => h.groupCallManager.onJoinError!('errUnavailable'))
    expect(h.toast.error).toHaveBeenCalledWith('errUnavailable')
  })
})
