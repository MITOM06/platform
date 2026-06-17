import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'chat_misc_providers.dart';
import 'chat_models.dart';

/// Parses `system.*` control messages (nickname / theme / quick-reaction
/// changes) and applies them to the matching per-conversation customization
/// notifiers.
///
/// Extracted from ChatNotifier (clean-code file limit). The exact parsing was
/// duplicated three times (initial load, reconnect catch-up, live new message);
/// this keeps that behaviour byte-for-byte while removing the duplication.
class ChatSystemMessageParser {
  const ChatSystemMessageParser._();

  /// Applies a single system message. No-op when [message] is not a system
  /// control message we recognise.
  static void apply(Ref ref, String conversationId, MessageModel message) {
    if (!message.isSystem) return;
    final content = message.content;
    if (content.startsWith('system.nickname.changed:')) {
      final parts = content.split(':');
      if (parts.length >= 2) {
        final targetId = parts[1];
        final nickname = parts.length > 2 ? parts.sublist(2).join(':') : '';
        ref
            .read(nicknamesProvider(conversationId).notifier)
            .setNickname(targetId, nickname);
      }
    } else if (content.startsWith('system.theme.changed:')) {
      final parts = content.split(':');
      final url = parts.length > 1 ? parts.sublist(1).join(':') : '';
      ref
          .read(chatWallpaperProvider(conversationId).notifier)
          .setWallpaper(url);
    } else if (content.startsWith('system.quick_reaction.changed:')) {
      final parts = content.split(':');
      final emoji = parts.length > 1 ? parts[1] : '👍';
      ref
          .read(quickReactionProvider(conversationId).notifier)
          .setQuickReaction(emoji);
    }
  }
}
