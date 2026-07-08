import 'package:flutter/widgets.dart';
import '../../../../core/l10n/l10n_ext.dart';

/// Content-only SANITIZED preview text for surfaces that have just a message's
/// raw `content` string and no structured type field (reply quotes,
/// conversation-list subtitles).
///
/// Enforces `no-raw-system-data-in-ui`: the returned text NEVER contains a raw
/// `system.*` code, an embedded user id, an internal upload URL, or a
/// serialized JSON payload (file / meeting-summary messages). Shared by
/// [ReplyQuote] and [ConversationTile] so both surfaces stay in sync.
String messagePreviewFromContent(BuildContext context, String content) {
  final l10n = context.l10n;

  // System control messages are stored as machine codes (never display text).
  if (content.startsWith('system.')) {
    return _systemPreviewLabel(context, content);
  }

  // Structured JSON payloads: file messages ({url,name,size}) and meeting
  // summaries ({overview,keyPoints,actionItems,…}). Only recognised payloads
  // are masked — an arbitrary user-pasted `{…}` text falls through to raw text.
  if (content.trimLeft().startsWith('{')) {
    if (content.contains('"url"') && content.contains('"name"')) {
      return '[${l10n.attachFile}]';
    }
    if (content.contains('"overview"') ||
        content.contains('"actionItems"') ||
        content.contains('"keyPoints"')) {
      return '[${l10n.meetingSummaryTitle}]';
    }
  }

  // Media / voice uploads store a bare `/api/uploads/…` URL.
  if (content.contains('/api/uploads/')) {
    return _attachmentLabelForUrl(context, content);
  }

  return content;
}

/// Localized bracketed attachment label inferred from an upload URL's
/// extension, falling back to the generic attachment label.
String _attachmentLabelForUrl(BuildContext context, String content) {
  final l10n = context.l10n;
  final lower = content.toLowerCase();
  bool hasAny(List<String> exts) => exts.any(lower.contains);
  if (hasAny(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.bmp'])) {
    return '[${l10n.attachPhoto}]';
  }
  if (hasAny(['.mp4', '.mov', '.webm', '.mkv', '.avi'])) {
    return '[${l10n.attachVideo}]';
  }
  if (hasAny(['.m4a', '.aac', '.mp3', '.ogg', '.wav', '.opus'])) {
    return '[${l10n.attachVoice}]';
  }
  return l10n.attachmentLabel;
}

/// Localized label for a `system.*` control message. These previews have no
/// participant name-resolution context, so pin/unpin notices use the generic
/// actor name — mirroring web's ConversationItem. Unknown codes fall back to a
/// generic localized system label rather than leaking the raw code + user ids.
String _systemPreviewLabel(BuildContext context, String content) {
  final l10n = context.l10n;
  if (content.startsWith('system.nickname.changed:')) {
    return l10n.systemNicknameChanged;
  }
  if (content.startsWith('system.theme.changed:')) {
    return l10n.systemThemeChanged;
  }
  if (content.startsWith('system.quick_reaction.changed:')) {
    return l10n.systemQuickReactionChanged;
  }
  if (content.startsWith('system.message.pinned:')) {
    return l10n.sysPinnedMessage(l10n.someone);
  }
  if (content.startsWith('system.message.unpinned:')) {
    return l10n.sysUnpinnedMessage(l10n.someone);
  }
  switch (content) {
    case 'system.group.created':
      return l10n.createGroup;
    case 'system.members.added':
      return l10n.addMembers;
    case 'system.member.left':
      return l10n.leaveGroup;
    case 'system.member.removed':
      return l10n.removeMember;
    case 'system.member.joined':
      return l10n.joinChannel;
    default:
      return l10n.pinnedSystemMessage;
  }
}
