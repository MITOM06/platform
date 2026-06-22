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

  return content
}
