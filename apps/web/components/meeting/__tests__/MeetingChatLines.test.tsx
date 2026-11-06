import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MeetingMessage } from '@/lib/api/meeting-types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/components/meeting/room/room-context', () => ({
  useRoom: () => ({ myId: 'me', myName: 'Me' }),
}))

import { ChatLine } from '@/components/meeting/room/MeetingChatLines'

const fmt = new Intl.DateTimeFormat('en', { timeStyle: 'short' })
const line = (userId: string, displayName: string | undefined, content: string): MeetingMessage =>
  ({ id: 'x', sender: displayName ? { userId, displayName } : { userId }, content, createdAt: '2026-11-06T10:00:00Z' })

describe('ChatLine AI', () => {
  it('renders the bot line as Markdown under the i18n name, never the id or server name', () => {
    const { container } = render(
      <ul><ChatLine message={line('ai-bot-000000000000000000000001', 'Server Name', 'a **bold** word')} showName timeFormat={fmt} /></ul>,
    )
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(screen.getByText('aiName')).toBeTruthy()
    expect(container.textContent).not.toContain('ai-bot-')
    expect(container.textContent).not.toContain('Server Name')
  })

  it('keeps human lines plain text', () => {
    const { container } = render(
      <ul><ChatLine message={line('u2', 'Bob', 'a **bold** word')} showName timeFormat={fmt} /></ul>,
    )
    expect(container.querySelector('strong')).toBeNull()
    expect(container.textContent).toContain('a **bold** word')
  })
})
