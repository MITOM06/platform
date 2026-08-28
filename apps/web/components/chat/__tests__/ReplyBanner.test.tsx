/**
 * Regression tests for the composer's reply banner and the message-search panel.
 *
 * Both surfaces used to render a message's raw `content`, so replying to (or searching up) a
 * system event, a file message or an image printed `system.nickname.changed:<userId>:<value>`,
 * a `{"url":…}` payload or an `/api/uploads/<id>` path straight at the user. That is a P1 under
 * .claude/rules/no-raw-system-data-in-ui.md, and the reply quote *inside* the bubble had already
 * been fixed — these two were the surfaces it was never applied to.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { Message } from '@/lib/api/types'

// Return the key so assertions read as "a localized label was used, not raw content".
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { ReplyBanner } from '@/components/chat/MessageInputParts'

const message = (over: Partial<Message>): Message =>
  ({
    id: 'm1',
    conversationId: 'c1',
    senderId: 'u1',
    senderName: 'Alice',
    content: 'hello',
    type: 'text',
    createdAt: new Date().toISOString(),
    readBy: [],
    ...over,
  }) as Message

describe('ReplyBanner — no raw system data', () => {
  it('humanizes a system-code message instead of printing the code and user id', () => {
    render(
      <ReplyBanner
        replyingTo={message({
          type: 'system',
          content: 'system.nickname.changed:6a3f1c2d4e5f6a7b8c9d0e1f:Bob',
        })}
      />,
    )

    expect(screen.queryByText(/system\.nickname\.changed/)).toBeNull()
    expect(screen.queryByText(/6a3f1c2d4e5f6a7b8c9d0e1f/)).toBeNull()
    expect(screen.getByText('systemNicknameChanged')).toBeInTheDocument()
  })

  it('labels a file message instead of printing its JSON payload', () => {
    render(
      <ReplyBanner
        replyingTo={message({
          type: 'file',
          content: '{"url":"/api/uploads/6e8f00aa","name":"salary.pdf","size":1024}',
        })}
      />,
    )

    expect(screen.queryByText(/api\/uploads/)).toBeNull()
    expect(screen.queryByText(/salary\.pdf/)).toBeNull()
    expect(screen.getByText('attachmentLabel')).toBeInTheDocument()
  })

  it('labels an image message instead of printing the upload URL', () => {
    render(
      <ReplyBanner
        replyingTo={message({ type: 'image', content: '/api/uploads/6e8f00aabbccdd' })}
      />,
    )

    expect(screen.queryByText(/api\/uploads/)).toBeNull()
    expect(screen.getByText('attachmentLabel')).toBeInTheDocument()
  })

  it('still shows ordinary text unchanged', () => {
    render(<ReplyBanner replyingTo={message({ content: 'see you at 5' })} />)

    expect(screen.getByText('see you at 5')).toBeInTheDocument()
  })
})
