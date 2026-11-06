/**
 * Every `system.*` code, preview type and markdown shape must come out as a
 * localized sentence — never the code, a user id, an upload URL or raw markdown
 * (.claude/rules/no-raw-system-data-in-ui.md). Complements system-messages.test.ts.
 */

import { describe, it, expect } from 'vitest'
import {
  flattenMarkdown,
  humanizeMessagePreview,
  humanizeSystemMessage,
} from '@/lib/system-messages'

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${Object.entries(values).map(([k, v]) => `${k}=${v}`).join(',')})` : key

const RAW_ID = '6e3f1c2d4e5f6a7b8c9d0e1f'
const names: Record<string, string> = { alice: 'Alice', bob: 'Bob' }
const resolveName = (id: string) => names[id]

describe('humanizeSystemMessage — pin / unpin', () => {
  it('names the actor when it resolves', () => {
    expect(humanizeSystemMessage('system.message.pinned:alice', t, { resolveName })).toBe(
      'systemPinnedMessage(name=Alice)',
    )
    expect(humanizeSystemMessage('system.message.unpinned:bob', t, { resolveName })).toBe(
      'systemUnpinnedMessage(name=Bob)',
    )
  })

  it('falls back to "someone" — never the raw actor id — when the name is unknown', () => {
    const pinned = humanizeSystemMessage(`system.message.pinned:${RAW_ID}`, t, { resolveName })
    expect(pinned).toBe('systemPinnedMessage(name=someone)')
    expect(pinned).not.toContain(RAW_ID)
    // No resolver at all (sidebar without participants).
    expect(humanizeSystemMessage(`system.message.unpinned:${RAW_ID}`, t)).toBe(
      'systemUnpinnedMessage(name=someone)',
    )
  })
})

describe('humanizeSystemMessage — admin change edge cases', () => {
  it('short variant drops the actor even when it resolves', () => {
    expect(
      humanizeSystemMessage('system.admin.promoted:bob', t, { resolveName, senderId: 'alice', short: true }),
    ).toBe('systemAdminPromoted(name=Bob)')
  })

  it('demotion of the viewer is addressed to them', () => {
    expect(
      humanizeSystemMessage('system.admin.demoted:bob', t, { resolveName, currentUserId: 'bob' }),
    ).toBe('systemAdminDemotedYou')
  })

  it('an actor whose name does not resolve gives the actor-less sentence, not the id', () => {
    const text = humanizeSystemMessage('system.admin.demoted:bob', t, { resolveName, senderId: RAW_ID })
    expect(text).toBe('systemAdminDemoted(name=Bob)')
  })

  it('an empty target is the generic sentence', () => {
    expect(humanizeSystemMessage('system.admin.promoted:', t, { resolveName })).toBe('systemAdminChanged')
  })
})

describe('humanizeSystemMessage — calls', () => {
  it('formats the call duration as mm:ss per kind', () => {
    expect(humanizeSystemMessage('system.call.ended:video:125', t)).toBe('systemVideoCallEnded(duration=02:05)')
    expect(humanizeSystemMessage('system.call.ended:voice:7', t)).toBe('systemVoiceCallEnded(duration=00:07)')
    expect(humanizeSystemMessage('system.call.ended:voice:3600', t)).toBe('systemVoiceCallEnded(duration=60:00)')
  })

  it('a missing duration reads 00:00', () => {
    expect(humanizeSystemMessage('system.call.ended:voice', t)).toBe('systemVoiceCallEnded(duration=00:00)')
  })

  it('missed calls by kind; unknown kind reads as voice', () => {
    expect(humanizeSystemMessage('system.call.missed:video', t)).toBe('systemVideoCallMissed')
    expect(humanizeSystemMessage('system.call.missed:voice', t)).toBe('systemVoiceCallMissed')
    expect(humanizeSystemMessage('system.call.missed:', t)).toBe('systemVoiceCallMissed')
  })
})

describe('humanizeSystemMessage — conversation settings', () => {
  it('theme change hides the theme payload', () => {
    expect(humanizeSystemMessage('system.theme.changed:#ff00aa', t)).toBe('systemThemeChanged')
  })

  it('quick reaction: full sentence carries the emoji, short does not, missing emoji defaults to 👍', () => {
    expect(humanizeSystemMessage('system.quick_reaction.changed:❤️', t)).toBe(
      'systemQuickReactionChanged(emoji=❤️)',
    )
    expect(humanizeSystemMessage('system.quick_reaction.changed:❤️', t, { short: true })).toBe(
      'systemQuickReactionChangedShort',
    )
    expect(humanizeSystemMessage('system.quick_reaction.changed:', t)).toBe(
      'systemQuickReactionChanged(emoji=👍)',
    )
  })

  it('nickname change never shows the user id or the nickname payload', () => {
    const text = humanizeSystemMessage(`system.nickname.changed:${RAW_ID}:Bobby`, t)
    expect(text).toBe('systemNicknameChanged')
  })

  it('auto-delete: 1h / 1w / 1m presets and a garbage value is "off"', () => {
    expect(humanizeSystemMessage('system.autodelete.changed:3600', t)).toBe(
      'systemAutoDeleteOn(duration=autoDelete1h)',
    )
    expect(humanizeSystemMessage('system.autodelete.changed:604800', t)).toBe(
      'systemAutoDeleteOn(duration=autoDelete1w)',
    )
    expect(humanizeSystemMessage('system.autodelete.changed:2592000', t)).toBe(
      'systemAutoDeleteOn(duration=autoDelete1m)',
    )
    expect(humanizeSystemMessage('system.autodelete.changed:abc', t)).toBe('systemAutoDeleteOff')
    expect(humanizeSystemMessage('system.autodelete.changed:-5', t)).toBe('systemAutoDeleteOff')
  })
})

describe('humanizeSystemMessage — membership codes and fallbacks', () => {
  it.each([
    ['system.group.created', 'systemGroupCreated'],
    ['system.members.added', 'systemMembersAdded'],
    ['system.member.left', 'systemMemberLeft'],
    ['system.member.removed', 'systemMemberRemoved'],
    ['system.member.joined', 'systemMemberJoined'],
  ])('%s → %s', (code, key) => {
    expect(humanizeSystemMessage(code, t)).toBe(key)
  })

  it('an unknown system code is a generic label, never words built from the code', () => {
    expect(humanizeSystemMessage('system.something.new:abc', t)).toBe('systemMessageLabel')
    expect(humanizeSystemMessage('system.member.left:extra', t)).toBe('systemMessageLabel')
  })

  it('upload URLs anywhere in the text become the attachment label', () => {
    expect(humanizeSystemMessage('see /api/uploads/6e8f00aa', t)).toBe('attachmentLabel')
  })

  it('JSON payloads: summary objects, file objects, mixed arrays', () => {
    expect(humanizeSystemMessage('{"actionItems":[],"keyPoints":[]}', t)).toBe('meetingSummaryLabel')
    expect(humanizeSystemMessage('{"url":"x","name":"a.pdf","size":3}', t)).toBe('attachmentLabel')
    // A JSON array that is NOT all upload URLs is not an attachment — it falls through as text.
    expect(humanizeSystemMessage('[1, 2]', t)).toBe('[1, 2]')
    expect(humanizeSystemMessage('{"other":1}', t)).toBe('{"other":1}')
    // Truncated (unparseable) array of strings still reads as an attachment.
    expect(humanizeSystemMessage('["/api/upl', t)).toBe('attachmentLabel')
    expect(humanizeSystemMessage('{"durationSec":12, "attend', t)).toBe('meetingSummaryLabel')
  })

  it('empty content passes through unchanged', () => {
    expect(humanizeSystemMessage('', t)).toBe('')
  })

  it('plain text is flattened (no markdown leaks)', () => {
    expect(humanizeSystemMessage('**Hi** _there_\n\n- one', t)).toBe('Hi there one')
  })
})

describe('flattenMarkdown', () => {
  it('strips fences, inline code, images, links, headings, emphasis, bullets and quotes', () => {
    const md = [
      '# Title',
      'Some **bold** and *em* and ~~gone~~ and `code`.',
      '```ts',
      'const secret = 1',
      '```',
      '![alt](/api/uploads/x.png)',
      '[docs](https://internal.example/path)',
      '> quoted',
      '* bullet',
      '+ plus',
    ].join('\n')
    expect(flattenMarkdown(md)).toBe('Title Some bold and em and gone and code. docs quoted bullet plus')
  })

  it('never keeps a link URL or an image path', () => {
    const out = flattenMarkdown('[click](https://svc.internal/api/uploads/abc) ![p](/api/uploads/def)')
    expect(out).toBe('click')
  })

  it('plain text passes through with whitespace collapsed', () => {
    expect(flattenMarkdown('  hello\n\n  world  ')).toBe('hello world')
  })
})

describe('humanizeMessagePreview', () => {
  it('empty content passes through', () => {
    expect(humanizeMessagePreview('', 'text', t)).toBe('')
  })

  it('system type is humanized even if the content lacks the prefix check', () => {
    expect(humanizeMessagePreview('system.member.left', 'system', t)).toBe('systemMemberLeft')
    expect(humanizeMessagePreview('system.member.joined', undefined, t)).toBe('systemMemberJoined')
  })

  it.each(['voice', 'image', 'video', 'file', 'sticker'])('media type %s never shows its URL', (type) => {
    expect(humanizeMessagePreview('/api/uploads/abc.bin', type, t)).toBe('attachmentLabel')
  })

  it('meeting summary type is labelled', () => {
    expect(humanizeMessagePreview('{"overview":"x"}', 'meeting_summary', t)).toBe('meetingSummaryLabel')
  })

  it('AI answers are flattened; an AI answer that flattens to nothing gets a label', () => {
    expect(humanizeMessagePreview('## Answer\n**42**', 'ai', t)).toBe('Answer 42')
    expect(humanizeMessagePreview('```\nonly code\n```', 'ai', t)).toBe('attachmentLabel')
  })

  it('unknown / null types sniff the content', () => {
    expect(humanizeMessagePreview('{"url":"/api/uploads/1"}', null, t)).toBe('attachmentLabel')
    expect(humanizeMessagePreview('hi *there*', 'text', t)).toBe('hi there')
  })
})
