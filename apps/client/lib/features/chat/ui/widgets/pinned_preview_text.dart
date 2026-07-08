import 'package:flutter/widgets.dart';
import '../../../../core/l10n/l10n_ext.dart';
import '../../domain/chat_state.dart';

/// Builds a SANITIZED, localized preview string for a pinned message.
///
/// Enforces the `no-raw-system-data-in-ui` rule: the returned text NEVER
/// contains raw system-message codes (`system.nickname.changed:<id>:…`), user
/// ids, internal upload URLs, or serialized JSON. Used by BOTH
/// [PinnedMessageBar] (chat header) and the pinned-messages info section so the
/// two surfaces stay in sync.
///
/// - `system`            → generic localized label (never the raw code/id).
/// - media / attachment  → bracketed attachment label, mirroring the
///                         conversation banner (e.g. `[Photo]`, `[File]`).
/// - text (default)      → trimmed content, falling back to `—` when empty.
String pinnedPreviewText(BuildContext context, PinnedMessageModel pinned) {
  final l10n = context.l10n;
  switch (pinned.type) {
    case 'system':
      // System messages are stored as machine codes — show a friendly label
      // instead of leaking the code + embedded user ids.
      return l10n.pinnedSystemMessage;
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
      // Content is a JSON payload (attendees/overview/keyPoints/…) — show a
      // localized label instead of leaking the raw serialized JSON.
      return '[${l10n.meetingSummaryTitle}]';
    case 'ai':
      // AI replies are plain markdown text — safe to preview flattened; fall
      // back to the em dash when empty.
      final aiText = pinned.content.trim();
      return aiText.isEmpty ? '—' : aiText;
    default:
      final text = pinned.content.trim();
      return text.isEmpty ? '—' : text;
  }
}
