import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const api = vi.hoisted(() => ({
  get: vi.fn(), hands: vi.fn(), lobby: vi.fn(), messages: vi.fn(), getNote: vi.fn(), putNote: vi.fn(), update: vi.fn(),
}))
vi.mock('@/lib/api/meetings', () => ({ meetingsApi: api }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))
vi.mock('@/lib/stomp/use-stomp-connected', () => ({ useStompConnected: () => true }))
vi.mock('@/components/chat/MarkdownContent', () => ({ MarkdownContent: ({ content }: { content: string }) => <div>{content}</div> }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(',')})` : key,
  useLocale: () => 'en',
  useNow: () => new Date('2026-10-08T03:00:00Z'),
}))

import type { Meeting } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import { MeetingRoom } from '@/components/meeting/room/MeetingRoom'
import { meetingKeys } from '@/lib/meetings/cache-updates'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'
import type { RemotePeer } from '@/lib/rtc/livekit-session'
import { useMeetingRoomStore } from '@/lib/store/meeting.store'

const MEETING: Meeting = { id: 'm1', code: 'abc-defg-hjk', title: 'Weekly', host: { userId: 'me' }, status: 'LIVE',
  settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'host', createdAt: '2026-10-08T00:00:00Z' }
const fakeStream = { getVideoTracks: () => [], getTracks: () => [] } as unknown as MediaStream
const PEER: RemotePeer = { identity: 'u2', name: 'Minh', stream: fakeStream, speaking: false, micMuted: false,
  camMuted: true, poorConnection: false, screen: null }

let controller: { [K in keyof MeetingRoomController]?: ReturnType<typeof vi.fn> }

function renderRoom(role: 'host' | 'attendee') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  qc.setQueryData(meetingKeys.roster('m1'), [
    { userId: 'me', displayName: 'Lan', role, joinedAt: '2026-10-08T01:00:00Z' },
    { userId: 'u2', displayName: 'Minh', role: 'attendee', joinedAt: '2026-10-08T01:01:00Z' },
  ])
  qc.setQueryData(meetingKeys.hands('m1'), [])
  qc.setQueryData(meetingKeys.lobby('m1'), [{ userId: 'g1', displayName: 'Guest Ha' }])
  useMeetingRoomStore.setState({ phase: 'inRoom', myRole: role, mic: true, camera: false, peers: [PEER] })
  render(
    <QueryClientProvider client={qc}>
      <MeetingRoom meeting={MEETING} controller={controller as unknown as MeetingRoomController} myId="me" myName="Lan" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
  api.messages.mockResolvedValue({ content: [], page: 0, size: 50, totalElements: 0, hasNext: false })
  api.getNote.mockResolvedValue({ scope: 'shared', content: '', version: 0 })
  controller = {
    toggleMic: vi.fn(async () => undefined), toggleCamera: vi.fn(async () => undefined),
    toggleScreenShare: vi.fn(async () => undefined), setHand: vi.fn(), leave: vi.fn(), endForAll: vi.fn(async () => undefined),
    hostCommand: vi.fn(), admit: vi.fn(async () => undefined), deny: vi.fn(async () => undefined),
    sendChat: vi.fn(() => 'c-1'), sendReaction: vi.fn(() => true), setPeerVideoEnabled: vi.fn(),
    registerNotesFlush: vi.fn(), switchDevice: vi.fn(async () => undefined),
  }
})
afterEach(() => {
  useMeetingRoomStore.getState().reset()
  vi.clearAllMocks()
})

async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  screen.getByRole('button', { name }).focus()
  await user.keyboard('{Enter}')
}

describe('MeetingRoom', () => {
  it('shows me and the other person, and the mic button drives the controller', async () => {
    const user = userEvent.setup()
    renderRoom('attendee')
    expect(screen.getByText('nameWithYou(Lan)')).toBeInTheDocument()
    expect(screen.getByText('Minh')).toBeInTheDocument()
    const mic = screen.getByRole('button', { name: 'deviceMic' })
    expect(mic).toHaveAttribute('aria-pressed', 'true')
    await user.click(mic)
    expect(controller.toggleMic).toHaveBeenCalled()
  })

  it('an attendee leaves with one button and sees no host controls', async () => {
    const user = userEvent.setup()
    renderRoom('attendee')
    await user.click(screen.getByRole('button', { name: 'leave' }))
    expect(controller.leave).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'people' }))
    expect(screen.queryByText('manageTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('Guest Ha')).not.toBeInTheDocument()
  })

  it('a host can end the meeting for everyone after confirming', async () => {
    const user = userEvent.setup()
    renderRoom('host')
    await openMenu(user, 'leave')
    await user.click(await screen.findByRole('menuitem', { name: 'endForAll' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'endForAll' }))
    expect(controller.endForAll).toHaveBeenCalled()
    expect(controller.leave).not.toHaveBeenCalled()
  })

  it('the People panel lets a host admit, mute someone, and use room switches', async () => {
    const user = userEvent.setup()
    renderRoom('host')
    await user.click(screen.getByRole('button', { name: 'people' }))
    expect(screen.getByText('sectionInMeeting(2)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'admit' }))
    expect(controller.admit).toHaveBeenCalledWith('g1')

    await openMenu(user, 'personMenu(Minh)')
    await user.click(await screen.findByRole('menuitem', { name: 'actionMuteMic' }))
    expect(controller.hostCommand).toHaveBeenCalledWith('MUTE_MIC', 'u2')

    await user.click(screen.getByRole('switch', { name: 'settingLocked' }))
    expect(controller.hostCommand).toHaveBeenCalledWith('LOCK')
  })

  it('chat sends on Enter and clears the box', async () => {
    const user = userEvent.setup()
    renderRoom('attendee')
    await user.click(screen.getByRole('button', { name: 'chat' }))
    const box = screen.getByRole('textbox', { name: 'chatPlaceholder' })
    await user.type(box, 'hello{Enter}')
    expect(controller.sendChat).toHaveBeenCalledWith('hello')
    expect(box).toHaveValue('')
  })
})
