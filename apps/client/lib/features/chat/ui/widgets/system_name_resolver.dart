import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../l10n/app_localizations.dart';
import '../../domain/chat_provider.dart';
import '../../domain/chat_state.dart';
import 'system_message_text.dart';

/// Names the people of a system message in [conversationId]: "You", their
/// nickname there, their display name — never the raw id. Ids that are not
/// users (the "system" sender, assistants) are never looked up. Shared by the
/// in-chat bubble and the conversation-list previews so both name the same
/// person the same way (web: `useNameResolver`).
///
/// Call the returned function while building (it watches providers).
SystemNameResolver systemNameResolver(
  WidgetRef ref,
  AppLocalizations l10n, {
  required String conversationId,
  required String currentUserId,
}) {
  return (String userId) {
    if (userId.isEmpty || isSystemSender(userId)) return l10n.someone;
    if (userId == currentUserId) return l10n.you;
    if (userId == kAiBotUserId || userId.startsWith('extbot:')) {
      return l10n.aiAssistant;
    }
    final nickname = ref.watch(nicknamesProvider(conversationId))[userId];
    if (nickname != null && nickname.isNotEmpty) return nickname;
    final profile = ref.watch(userProfileProvider(userId)).valueOrNull;
    return profile?.displayName ?? l10n.someone;
  };
}
