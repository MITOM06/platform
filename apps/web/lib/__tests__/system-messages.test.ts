/**
 * Humanizers for system codes and previews (.claude/rules/no-raw-system-data-in-ui.md).
 * Mirrors Flutter's system-message parser — every code maps to a localized
 * sentence, never the code, a user id or a JSON payload.
 */

import { describe, it, expect } from 'vitest'
import {
  humanizeLastMessage,
  humanizeReplyPreview,
  humanizeSystemMessage,
} from '@/lib/system-messages'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(',')})` : key

const names: Record<string, string> = { alice: 'Alice', bob: 'Bob', me: 'You' }
const resolveName = (id: string) => names[id]

describe('humanizeSystemMessage — new round-1/round-2 codes', () => {
  it('auto-delete: 0 = off, known presets by label, other values generic', () => {
    expect(humanizeSystemMessage('system.autodelete.changed:0', t)).toBe('systemAutoDeleteOff')
    expect(humanizeSystemMessage('system.autodelete.changed:86400', t)).toBe(
      'systemAutoDeleteOn(duration=autoDelete1d)',
    )
    expect(humanizeSystemMessage('system.autodelete.changed:300', t)).toBe('systemAutoDeleteOnGeneric')
    expect(humanizeSystemMessage('system.autodelete.changed:', t)).toBe('systemAutoDeleteOff')
  })

  it('admin promoted / demoted with the acting admin as sender', () => {
    expect(
      humanizeSystemMessage('system.admin.promoted:bob', t, { resolveName, senderId: 'alice' }),
    ).toBe('systemAdminPromotedBy(actor=Alice,name=Bob)')
    expect(
      humanizeSystemMessage('system.admin.demoted:bob', t, { resolveName, senderId: 'alice' }),
    ).toBe('systemAdminDemotedBy(actor=Alice,name=Bob)')
  })

  it('uses actor-less wording when the sender is `system` (or the target itself)', () => {
    expect(
      humanizeSystemMessage('system.admin.promoted:bob', t, { resolveName, senderId: 'system' }),
    ).toBe('systemAdminPromoted(name=Bob)')
    expect(
      humanizeSystemMessage('system.admin.demoted:bob', t, { resolveName, senderId: 'bob' }),
    ).toBe('systemAdminDemoted(name=Bob)')
  })

  it('addresses the viewer directly when they are the target', () => {
    expect(
      humanizeSystemMessage('system.admin.promoted:me', t, {
        resolveName,
        senderId: 'alice',
        currentUserId: 'me',
      }),
    ).toBe('systemAdminPromotedYou')
  })

  it('never prints the raw target id when the name is unknown', () => {
    const text = humanizeSystemMessage('system.admin.promoted:6e3f1c2d4e5f6a7b8c9d0e1f', t, {
      resolveName,
      senderId: 'alice',
    })
    expect(text).toBe('systemAdminChanged')
    expect(text).not.toContain('6e3f')
  })

  it('labels truncated JSON payloads instead of printing them', () => {
    expect(humanizeSystemMessage('{"overview":"We discussed the roadm', t)).toBe('meetingSummaryLabel')
    expect(humanizeSystemMessage('{"url":"/api/upl', t)).toBe('attachmentLabel')
    expect(humanizeSystemMessage('["/api/uploads/a","/api/uploads/b"]', t)).toBe('attachmentLabel')
    expect(humanizeSystemMessage('{not a payload}', t)).toBe('{not a payload}')
  })
})

describe('previews', () => {
  it('a recalled last message shows the recalled label, never its old text', () => {
    expect(
      humanizeLastMessage({ content: '', senderId: 'bob', recalled: true }, t),
    ).toBe('recalled')
    expect(humanizeLastMessage({ content: 'hello', senderId: 'bob' }, t)).toBe('hello')
    expect(humanizeLastMessage(null, t)).toBeNull()
    expect(humanizeLastMessage({ content: '', senderId: 'bob' }, t)).toBeNull()
  })

  it('a system last message is humanized with its sender as actor', () => {
    expect(
      humanizeLastMessage(
        { content: 'system.admin.promoted:bob', senderId: 'alice', type: 'system' },
        t,
        { resolveName },
      ),
    ).toBe('systemAdminPromoted(name=Bob)')
  })

  it('a recalled reply quote shows the recalled label', () => {
    expect(humanizeReplyPreview({ content: '', senderId: 'bob', recalled: true }, t)).toBe('recalled')
    expect(humanizeReplyPreview({ content: 'system.autodelete.changed:0', senderId: 'system' }, t)).toBe(
      'systemAutoDeleteOff',
    )
  })
})
