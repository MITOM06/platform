// Shared humanizer for `system.*` messages — single source of truth used by
// both ConversationItem (sidebar preview) and MessageBubble (chat area).
// Mirrors Flutter `message_bubble_parts.dart:_systemText` +
// `conversation_tile.dart:_subtitleText` (cross-platform parity).

type Translate = (key: string, values?: Record<string, string | number>) => string

export interface HumanizeOptions {
  /** Concise sidebar / preview variant. */
  short?: boolean
  /** Resolve a user id to a display name (current user → "You"). */
  resolveName?: (userId: string) => string | undefined
  /** The message's `senderId` — the actor of codes whose sender is the actor. */
  senderId?: string
  /** The viewer, for "You are now an admin"-style wording. */
  currentUserId?: string
}

/** Sender id of system messages written by the server itself (no human actor). */
export const SYSTEM_SENDER_ID = 'system'

/** Auto-delete presets with an existing localized label (seconds → `chat.*` key). */
const AUTO_DELETE_LABELS: Record<number, string> = {
  3600: 'autoDelete1h',
  86400: 'autoDelete1d',
  604800: 'autoDelete1w',
  2592000: 'autoDelete1m',
}

function humanizeAutoDelete(content: string, t: Translate): string {
  const seconds = parseInt(content.slice('system.autodelete.changed:'.length), 10)
  if (!Number.isFinite(seconds) || seconds <= 0) return t('systemAutoDeleteOff')
  const label = AUTO_DELETE_LABELS[seconds]
  return label ? t('systemAutoDeleteOn', { duration: t(label) }) : t('systemAutoDeleteOnGeneric')
}

/**
 * `system.admin.promoted:<targetId>` / `system.admin.demoted:<targetId>`. The
 * sender is the acting admin; a `system` sender (server-side heir promotion) gets
 * the actor-less sentence.
 */
function humanizeAdminChange(content: string, t: Translate, opts?: HumanizeOptions): string {
  const promoted = content.startsWith('system.admin.promoted:')
  const targetId = content.slice(content.indexOf(':') + 1)
  if (targetId && targetId === opts?.currentUserId) {
    return promoted ? t('systemAdminPromotedYou') : t('systemAdminDemotedYou')
  }
  const name = (targetId && opts?.resolveName?.(targetId)) || undefined
  if (!name) return t('systemAdminChanged')
  const actorId = opts?.senderId
  const actor =
    actorId && actorId !== SYSTEM_SENDER_ID && actorId !== targetId
      ? opts?.resolveName?.(actorId)
      : undefined
  if (actor && !opts?.short) {
    return promoted
      ? t('systemAdminPromotedBy', { actor, name })
      : t('systemAdminDemotedBy', { actor, name })
  }
  return promoted ? t('systemAdminPromoted', { name }) : t('systemAdminDemoted', { name })
}

/**
 * Does `content` look like a JSON payload (file / media / meeting summary)? Reply
 * quotes and previews may be TRUNCATED server-side, so a parse failure alone does
 * not make it plain text — sniff the leading keys too.
 */
function jsonPayloadLabel(content: string, t: Translate): string | null {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      return parsed.every((u) => typeof u === 'string' && u.includes('/api/uploads/'))
        ? t('attachmentLabel')
        : null
    }
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>
      if ('overview' in obj || 'actionItems' in obj || 'keyPoints' in obj) return t('meetingSummaryLabel')
      if ('url' in obj) return t('attachmentLabel')
    }
    return null
  } catch {
    if (/^\{\s*"(overview|attendees|durationSec|keyPoints|actionItems)"/.test(trimmed)) {
      return t('meetingSummaryLabel')
    }
    if (/^\{\s*"(url|name|size)"/.test(trimmed) || /^\[\s*"/.test(trimmed)) return t('attachmentLabel')
    return null
  }
}

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
  opts?: HumanizeOptions,
): string {
  if (!content) return content

  // JSON payloads (file/media message content or a meeting-summary) must never
  // render raw (.claude/rules/no-raw-system-data-in-ui.md). Sniff the shape when
  // no message type is available (e.g. conversation-list last-message, reply
  // quotes) and map to the localized label.
  const payloadLabel = jsonPayloadLabel(content, t)
  if (payloadLabel) return payloadLabel

  // Attachment detection (mirror Flutter conversation_tile `/api/uploads/`).
  if (content.includes('/api/uploads/')) return t('attachmentLabel')

  if (content.startsWith('system.autodelete.changed:')) return humanizeAutoDelete(content, t)
  if (content.startsWith('system.admin.promoted:') || content.startsWith('system.admin.demoted:')) {
    return humanizeAdminChange(content, t, opts)
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

  // Unknown `system.*` code → a generic localized label, matching Flutter's
  // `_systemPreviewLabel` fallback. This used to build words out of the code itself
  // ("📢 nickname changed"), which showed machine-derived English to every user
  // regardless of locale — the code leaking in a thin disguise.
  if (content.startsWith('system.')) {
    return t('systemMessageLabel')
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
  type: string | undefined | null,
  t: Translate,
  opts?: HumanizeOptions,
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

/**
 * Conversation-list preview of the newest message (sidebar, Archived tab, requests).
 * A recalled message never shows its old text (`recalled` + blank content).
 */
export function humanizeLastMessage(
  lastMessage:
    | { content: string; senderId?: string; type?: string | null; recalled?: boolean }
    | null
    | undefined,
  t: Translate,
  opts?: HumanizeOptions,
): string | null {
  if (!lastMessage) return null
  if (lastMessage.recalled) return t('recalled')
  if (!lastMessage.content) return null
  return humanizeMessagePreview(lastMessage.content, lastMessage.type, t, {
    short: true,
    senderId: lastMessage.senderId,
    ...opts,
  })
}

/** A reply quote's text: recalled originals show the localized label, never stale text. */
export function humanizeReplyPreview(
  preview: { content: string; senderId?: string; recalled?: boolean },
  t: Translate,
  opts?: HumanizeOptions,
): string {
  if (preview.recalled) return t('recalled')
  return humanizeMessagePreview(preview.content, undefined, t, { short: true, ...opts })
}
