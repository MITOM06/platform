/**
 * Tests for MessageBubble component.
 *
 * Strategy: mock heavy sub-components (MessageActions, modals, media players)
 * and the next-intl / hook layer so tests remain fast and focused on rendering
 * logic (text, recalled placeholder, system message).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { Message } from '@/lib/api/types'

// ── Stub sub-components ────────────────────────────────────────────────────

vi.mock('@/components/chat/MessageActions', () => ({
  MessageActions: () => null,
}))
vi.mock('@/components/chat/ImageContent', () => ({
  ImageContent: () => <div data-testid="image-content" />,
  VideoContent: () => <div data-testid="video-content" />,
}))
vi.mock('@/components/chat/FileContent', () => ({
  FileContent: () => <div data-testid="file-content" />,
}))
vi.mock('@/components/chat/VoiceMessage', () => ({
  VoiceMessage: () => <div data-testid="voice-content" />,
}))
vi.mock('@/components/chat/LinkPreviewCard', () => ({
  LinkPreviewCard: () => null,
}))
vi.mock('@/components/chat/UserProfileDrawer', () => ({
  UserProfileDrawer: () => null,
}))
vi.mock('@/components/chat/GroupReadDetailsModal', () => ({
  GroupReadDetailsModal: () => null,
}))
vi.mock('@/components/chat/ReactionsDetailModal', () => ({
  ReactionsDetailModal: () => null,
}))

// ── Stub hooks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/nicknames', () => ({
  useNickname: (_convId: string, userId?: string) => (userId ? undefined : undefined),
}))

vi.mock('@/lib/hooks/use-user', () => ({
  useUser: () => ({ data: undefined, isLoading: false }),
}))

// ── Stub next-intl ─────────────────────────────────────────────────────────
// Return a pass-through translator so we test structural output using the
// i18n key itself (e.g. "recalled") rather than locale-specific text.

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

// ── Stub lib/media (firstUrl) ──────────────────────────────────────────────

vi.mock('@/lib/media', () => ({
  firstUrl: () => null,
  absoluteMediaUrl: (url: string) => url,
}))

// ── Helper ─────────────────────────────────────────────────────────────────

function baseMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    senderName: 'Alice',
    content: 'Hello world',
    type: 'text',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

const defaultProps = {
  isOwn: false,
  currentUserId: 'user-2',
  conversationId: 'conv-1',
  onOptimisticUpdate: vi.fn(),
}

// Lazy-import so all mocks are installed before module loads.
async function renderBubble(msgOverrides: Partial<Message> = {}, propOverrides: Record<string, unknown> = {}) {
  const { MessageBubble } = await import('@/components/chat/MessageBubble')
  const msg = baseMessage(msgOverrides)
  render(<MessageBubble message={msg} {...defaultProps} {...propOverrides} />)
  return msg
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('MessageBubble', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('renders text message content', async () => {
    await renderBubble({ content: 'Hello world', type: 'text' })
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders the "recalled" placeholder when message is recalled', async () => {
    await renderBubble({ recalled: true, content: 'should not appear' })

    // The i18n stub returns the key "recalled" as-is.
    expect(screen.getByText('recalled')).toBeInTheDocument()
    // Original content must NOT be visible.
    expect(screen.queryByText('should not appear')).not.toBeInTheDocument()
  })

  it('renders system message text via humanizeSystemMessage', async () => {
    await renderBubble({
      type: 'system',
      content: 'system.group.created',
    })
    // humanizeSystemMessage maps 'system.group.created' → t('systemGroupCreated')
    // With the stub translator, t('systemGroupCreated') === 'systemGroupCreated'.
    expect(screen.getByText('systemGroupCreated')).toBeInTheDocument()
  })

  it('renders system call message with phone icon area', async () => {
    await renderBubble({
      type: 'system',
      content: 'system.call.missed:audio',
    })
    // humanizeSystemMessage → t('systemVoiceCallMissed') → 'systemVoiceCallMissed'
    expect(screen.getByText('systemVoiceCallMissed')).toBeInTheDocument()
  })

  it('renders AI error content with error key', async () => {
    await renderBubble({ type: 'ai', content: '__AI_ERROR__' })
    // t('aiError') → 'aiError'
    expect(screen.getByText('aiError')).toBeInTheDocument()
  })

  it('renders image content using ImageContent stub', async () => {
    await renderBubble({ type: 'image', content: '/api/uploads/img.jpg' })
    expect(screen.getByTestId('image-content')).toBeInTheDocument()
  })

  it('renders file content using FileContent stub', async () => {
    await renderBubble({ type: 'file', content: '/api/uploads/doc.pdf' })
    expect(screen.getByTestId('file-content')).toBeInTheDocument()
  })

  it('does not render original content when message is recalled, even for own messages', async () => {
    await renderBubble({ recalled: true, content: 'secret content' }, { isOwn: true })
    expect(screen.getByText('recalled')).toBeInTheDocument()
    expect(screen.queryByText('secret content')).not.toBeInTheDocument()
  })

  it('renders reactions badges when message has reactions', async () => {
    await renderBubble({
      type: 'text',
      content: 'hi',
      reactions: [
        { userId: 'u1', emoji: '👍' },
        { userId: 'u2', emoji: '👍' },
        { userId: 'u3', emoji: '❤️' },
      ],
    })
    // Two distinct emoji badges should appear.
    expect(screen.getByText('👍')).toBeInTheDocument()
    expect(screen.getByText('❤️')).toBeInTheDocument()
  })
})
