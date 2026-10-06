import 'package:flutter/widgets.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/conversation_models.dart';
import 'system_message_text.dart';

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

/// Localized label for a `system.*` control message. Previews have no
/// participant context, so names are generic; unknown codes fall back to a
/// generic localized label rather than leaking the raw code + user ids.
String _systemPreviewLabel(BuildContext context, String content) =>
    systemPreviewText(context.l10n, content);

/// Sanitized preview of a conversation's last message: recalled → the
/// localized "message recalled" label; typed media/system/AI previews by
/// `type` when the server sent one; else the content-sniffing preview.
String lastMessagePreview(BuildContext context, LastMessageModel last) {
  final l10n = context.l10n;
  if (last.recalled) return l10n.messageRecalled;
  switch (last.type) {
    case 'image':
      return '[${l10n.attachPhoto}]';
    case 'video':
      return '[${l10n.attachVideo}]';
    case 'file':
      return '[${l10n.attachFile}]';
    case 'voice':
      return '[${l10n.attachVoice}]';
    case 'sticker':
      return '[${l10n.attachSticker}]';
    case 'meeting_summary':
      return '[${l10n.meetingSummaryTitle}]';
    case 'system':
      return systemPreviewText(l10n, last.content);
  }
  return messagePreviewFromContent(context, last.content);
}
