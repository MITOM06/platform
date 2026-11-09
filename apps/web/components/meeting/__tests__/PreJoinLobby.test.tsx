import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useNow: () => new Date('2026-10-08T03:00:00Z'),
}))
vi.mock('@/lib/hooks/use-media-preview', () => ({
  useMediaPreview: () => ({
    devices: { audioinput: [], videoinput: [], audiooutput: [] },
    audioInput: '', videoInput: '', audioOutput: '', mic: false, camera: false, error: null, stream: null,
    selectDevice: vi.fn(), toggleMic: vi.fn(), toggleCamera: vi.fn(), release: vi.fn(),
  }),
}))
vi.mock('@/components/meeting/room/PrejoinPreview', () => ({ PrejoinPreview: () => <div /> }))
vi.mock('@/components/meeting/room/DeviceSelects', () => ({ DeviceSelects: () => <div /> }))

import type { Meeting } from '@/lib/api/meeting-types'
import { DEFAULT_MEETING_SETTINGS } from '@/lib/api/meeting-types'
import { PreJoinLobby } from '@/components/meeting/room/PreJoinLobby'
import type { MeetingRoomController } from '@/lib/meetings/meeting-room-controller'

const MEETING: Meeting = { id: 'm1', code: 'abc-defg-hjk', title: 'Weekly', host: { userId: 'u1' }, status: 'LIVE',
  settings: DEFAULT_MEETING_SETTINGS, viewerRole: 'invited', createdAt: '2026-10-08T00:00:00Z' }

describe('PreJoinLobby', () => {
  it('offers a way back to the meetings list at the top of the full-screen page', () => {
    render(<PreJoinLobby meeting={MEETING} controller={{} as MeetingRoomController} busy={false} myName="Lan" />)
    const links = screen.getAllByRole('link', { name: 'backToList' })
    expect(links).toHaveLength(2)
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/meetings', '/meetings'])
    // The first one sits above the preview and the meeting title.
    const heading = screen.getByRole('heading', { name: 'Weekly' })
    expect(links[0].compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
