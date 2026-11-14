import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { makeQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/lib/store/auth.store'
import { AI_BOT_ID } from '@/lib/constants'
import { setNickname } from '@/lib/nicknames'

const h = vi.hoisted(() => ({ assistantName: null as string | null, getUser: vi.fn() }))
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => `t:${k}` }))
vi.mock('@/lib/hooks/use-capabilities', () => ({ useAssistantName: () => h.assistantName }))
vi.mock('@/lib/api/auth', () => ({ authService: { getUser: h.getUser } }))

import { isHumanUserId, useNameResolver, useSenderDisplayName } from '@/lib/hooks/use-display-names'

beforeEach(() => {
  localStorage.clear()
  h.assistantName = null
  h.getUser.mockReset()
  useAuthStore.setState({ user: { id: 'me' } as never })
})

describe('isHumanUserId', () => {
  it('rejects empty, AI, system and external bots', () => {
    expect(isHumanUserId('u1')).toBe(true)
    expect(isHumanUserId('')).toBe(false)
    expect(isHumanUserId(null)).toBe(false)
    expect(isHumanUserId(AI_BOT_ID)).toBe(false)
    expect(isHumanUserId('system')).toBe(false)
    expect(isHumanUserId('extbot:abc')).toBe(false)
  })
})

describe('useNameResolver', () => {
  it('resolves me / AI / nickname / cached profile / unknown', () => {
    const { qc, wrapper } = makeQueryWrapper()
    qc.setQueryData(['user', 'u2'], { displayName: 'Bob' })
    qc.setQueryData(['user', 'u3'], { displayName: 'u3' })
    setNickname('c1', 'u4', 'Dee')
    const { result } = renderHook(() => useNameResolver('c1'), { wrapper })
    const r = result.current
    expect(r('')).toBeUndefined()
    expect(r('me')).toBe('t:you')
    expect(r(AI_BOT_ID)).toBe('t:aiAssistant')
    expect(r('u4')).toBe('Dee')
    expect(r('u2')).toBe('Bob')
    expect(r('u3')).toBeUndefined()
    expect(r('nobody')).toBeUndefined()
  })

  it('uses the workspace assistant name and ignores nicknames without a conversation', () => {
    h.assistantName = 'Jarvis'
    setNickname('c1', 'u4', 'Dee')
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useNameResolver(), { wrapper })
    expect(result.current(AI_BOT_ID)).toBe('Jarvis')
    expect(result.current('u4')).toBeUndefined()
  })
})

describe('useSenderDisplayName', () => {
  it('disabled or missing sender → empty', () => {
    const { wrapper } = makeQueryWrapper()
    expect(renderHook(() => useSenderDisplayName('u1', 'c1', false), { wrapper }).result.current).toBe('')
    expect(renderHook(() => useSenderDisplayName(undefined, 'c1'), { wrapper }).result.current).toBe('')
    expect(h.getUser).not.toHaveBeenCalled()
  })

  it('nickname wins without a profile lookup', async () => {
    setNickname('c1', 'u1', 'Nick')
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useSenderDisplayName('u1', 'c1'), { wrapper })
    await waitFor(() => expect(result.current).toBe('Nick'))
  })

  it('AI bot uses the assistant name or the default label; system → member label', () => {
    const { wrapper } = makeQueryWrapper()
    expect(renderHook(() => useSenderDisplayName(AI_BOT_ID, 'c1'), { wrapper }).result.current).toBe('t:aiAssistant')
    h.assistantName = 'Jarvis'
    expect(renderHook(() => useSenderDisplayName(AI_BOT_ID, 'c1'), { wrapper }).result.current).toBe('Jarvis')
    expect(renderHook(() => useSenderDisplayName('system', 'c1'), { wrapper }).result.current).toBe('t:memberDefault')
  })

  it('loads the profile: "" while loading, then the name', async () => {
    let resolve!: (u: unknown) => void
    h.getUser.mockReturnValue(new Promise((r) => { resolve = r }))
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useSenderDisplayName('u1', undefined), { wrapper })
    expect(result.current).toBe('')
    resolve({ id: 'u1', displayName: 'Ann' })
    await waitFor(() => expect(result.current).toBe('Ann'))
  })

  it('a raw-id or failed profile falls back to the member label', async () => {
    h.getUser.mockResolvedValueOnce({ id: 'u1', displayName: 'u1' })
    const { wrapper } = makeQueryWrapper()
    const { result } = renderHook(() => useSenderDisplayName('u1', 'c1'), { wrapper })
    await waitFor(() => expect(result.current).toBe('t:memberDefault'))
    h.getUser.mockRejectedValueOnce(new Error('404'))
    const w2 = makeQueryWrapper()
    const r2 = renderHook(() => useSenderDisplayName('u9', 'c1'), { wrapper: w2.wrapper })
    await waitFor(() => expect(r2.result.current).toBe('t:memberDefault'))
  })
})
