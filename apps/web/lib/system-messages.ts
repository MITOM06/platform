// Shared humanizer for `system.*` messages — single source of truth used by
// both ConversationItem (sidebar preview) and MessageBubble (chat area).
// Mirrors Flutter `message_bubble_parts.dart:_systemText` +
// `conversation_tile.dart:_subtitleText` (cross-platform parity).

type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * Map a `system.*` code (or any last-message content) to clean human-readable
 * text. Returns the original content untouched if it is not a system code.
 *
 * `opts.short` collapses parameterised forms to the concise sidebar variant
 * (e.g. "Nickname was changed" instead of the full actor/target sentence), so
 * the sidebar preview stays compact like Flutter's `_subtitleText`.
 *
 * `opts.resolveName(actorId)` resolves an actor's display name for codes that
 * carry one (`system.message.pinned:<actorId>`). When omitted (e.g. sidebar
 * preview without participant context) the rendered name falls back to a
 * generic label. Mirrors Flutter `message_bubble_parts.dart` actor resolution.
 */
export function humanizeSystemMessage(
  content: string,
  t: Translate,
  opts?: { short?: boolean; resolveName?: (actorId: string) => string | undefined },
): string {
  if (!content) return content

  // Attachment detection (mirror Flutter conversation_tile `/api/uploads/`).
  if (content.includes('/api/uploads/')) return t('attachmentLabel')

  // JSON payloads (file/media message content or a meeting-summary) must never
  // render raw (.claude/rules/no-raw-system-data-in-ui.md). Sniff the shape when
  // no message type is available (e.g. conversation-list last-message, reply
  // quotes) and map to the localized label.
  if (content.startsWith('{') && content.endsWith('}')) {
    try {
      const obj = JSON.parse(content) as Record<string, unknown>
      if ('overview' in obj || 'actionItems' in obj || 'keyPoints' in obj) {
        return t('meetingSummaryLabel')
      }
      if ('url' in obj) return t('attachmentLabel')
    } catch {
      // not JSON — fall through
    }
  }

  if (content.startsWith('system.message.pinned:') || content.startsWith('system.message.unpinned:')) {
    const pinned = content.startsWith('system.message.pinned:')
    const actorId = content.slice(content.indexOf(':') + 1)
    const name = opts?.resolveName?.(actorId) || t('someone')
    return pinned
      ? t('systemPinnedMessage', { name })
      : t('systemUnpinnedMessage', { name })
  }

  if (content.startsWith('system.call.ended:')) {
    const [, kind, secondsRaw] = content.split(':')
    const totalSec = parseInt(secondsRaw ?? '0', 10)
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    const duration = `${mm}:${ss}`
    return kind === 'video'
      ? t('systemVideoCallEnded', { duration })
      : t('systemVoiceCallEnded', { duration })
  }
  if (content.startsWith('system.call.missed:')) {
    const kind = content.split(':')[1]
    return kind === 'video' ? t('systemVideoCallMissed') : t('systemVoiceCallMissed')
  }
  if (content.startsWith('system.theme.changed:')) {
    return t('systemThemeChanged')
  }
  if (content.startsWith('system.quick_reaction.changed:')) {
    const emoji = content.split(':')[1] || '👍'
    return opts?.short
      ? t('systemQuickReactionChangedShort')
      : t('systemQuickReactionChanged', { emoji })
  }
  if (content.startsWith('system.nickname.changed:')) {
    return t('systemNicknameChanged')
  }

  switch (content) {
    case 'system.group.created':
      return t('systemGroupCreated')
    case 'system.members.added':
      return t('systemMembersAdded')
    case 'system.member.left':
      return t('systemMemberLeft')
    case 'system.member.removed':
      return t('systemMemberRemoved')
    case 'system.member.joined':
      return t('systemMemberJoined')
    default:
      break
  }

  // Unknown `system.*` code → degrade gracefully (mirror Flutter fallback).
  if (content.startsWith('system.')) {
    return `📢 ${content.split(':')[0].replace('system.', '').replace(/\./g, ' ')}`
  }

  // Plain text (incl. AI answers) — flatten markdown to a clean one-line preview
  // so previews never leak raw markdown syntax.
  return flattenMarkdown(content)
}

const MEDIA_PREVIEW_TYPES = new Set(['voice', 'image', 'video', 'file', 'sticker'])

/**
 * Flatten markdown to a compact plain-text preview: strip code fences, inline
 * code, images/links, headings, emphasis, bullets and blockquotes, and collapse
 * whitespace. Plain text passes through (minus newline collapsing). Used for
 * previews (pinned bar/section, conversation-list, reply quotes) so AI markdown
 * never leaks its raw syntax.
 */
export function flattenMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/(\*\*|__|\*|_|~~)/g, '') // emphasis markers
    .replace(/^\s*[-*+]\s+/gm, '') // list bullets
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/\s+/g, ' ') // collapse whitespace/newlines
    .trim()
}

/**
 * Humanize any message for a compact preview (pinned bar/section,
 * conversation-list last-message, reply quotes). Never leaks raw JSON payloads,
 * markdown, `system.*` codes or upload URLs — see
 * .claude/rules/no-raw-system-data-in-ui.md. `type` is optional (the
 * conversation-list last-message and reply quotes carry none); when absent the
 * content itself is sniffed via {@link humanizeSystemMessage}.
 */
export function humanizeMessagePreview(
  content: string,
  type: string | undefined,
  t: Translate,
  opts?: { short?: boolean; resolveName?: (actorId: string) => string | undefined },
): string {
  if (!content) return content
  if (type === 'system' || content.startsWith('system.')) {
    return humanizeSystemMessage(content, t, opts)
  }
  if (type && MEDIA_PREVIEW_TYPES.has(type)) return t('attachmentLabel')
  if (type === 'meeting_summary') return t('meetingSummaryLabel')
  if (type === 'ai') return flattenMarkdown(content) || t('attachmentLabel')
  // Unknown/typeless → sniff the content (system codes, uploads, JSON payloads,
  // markdown) through the shared humanizer.
  return humanizeSystemMessage(content, t, opts)
}
