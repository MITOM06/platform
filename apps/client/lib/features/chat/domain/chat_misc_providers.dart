import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/theme_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_state.dart';
import '../data/chat_repository.dart';
import 'chat_state.dart';

// Lightweight providers + per-conversation customization StateNotifiers split
// out of chat_provider.dart (clean-code file limit). None use codegen.

final userStatusProvider =
    FutureProvider.autoDispose.family<UserStatus, String>((ref, userId) {
  return ref.read(chatRepositoryProvider).getUserStatus(userId);
});

final userProfileProvider =
    FutureProvider.autoDispose.family<UserModel, String>((ref, userId) {
  return ref.read(authRepositoryProvider).getUserProfile(userId);
});

/// Conversations the current user has archived (Task 71).
final archivedConversationsProvider =
    FutureProvider.autoDispose<List<ConversationModel>>((ref) {
  return ref.read(chatRepositoryProvider).listArchivedConversations();
});

/// Fetches Open Graph metadata for a URL (cached per-url for the screen's life).
final linkPreviewProvider =
    FutureProvider.autoDispose.family<LinkPreviewData, String>((ref, url) {
  return ref.read(chatRepositoryProvider).fetchLinkPreview(url);
});

// ── Collaborative Customization Sync Providers (Task 79) ────────────────────

class ChatWallpaperNotifier extends StateNotifier<String?> {
  final Ref ref;
  final String conversationId;

  ChatWallpaperNotifier(this.ref, this.conversationId) : super(null) {
    final prefs = ref.watch(sharedPreferencesProvider);
    state = prefs.getString('chat_wallpaper_$conversationId');
  }

  Future<void> setWallpaper(String? url) async {
    final prefs = ref.read(sharedPreferencesProvider);
    if (url == null || url.isEmpty) {
      await prefs.remove('chat_wallpaper_$conversationId');
      state = null;
    } else {
      await prefs.setString('chat_wallpaper_$conversationId', url);
      state = url;
    }
  }
}

final chatWallpaperProvider = StateNotifierProvider.family<ChatWallpaperNotifier, String?, String>((ref, conversationId) {
  return ChatWallpaperNotifier(ref, conversationId);
});

class NicknamesNotifier extends StateNotifier<Map<String, String>> {
  final Ref ref;
  final String conversationId;

  NicknamesNotifier(this.ref, this.conversationId) : super(const {}) {
    final prefs = ref.watch(sharedPreferencesProvider);
    final List<String> list = prefs.getStringList('chat_nicknames_$conversationId') ?? [];
    final map = <String, String>{};
    for (final item in list) {
      final idx = item.indexOf(':');
      if (idx != -1) {
        final key = item.substring(0, idx);
        final val = item.substring(idx + 1);
        map[key] = val;
      }
    }
    state = map;
  }

  Future<void> setNickname(String userId, String nickname) async {
    final prefs = ref.read(sharedPreferencesProvider);
    final map = Map<String, String>.from(state);
    if (nickname.isEmpty) {
      map.remove(userId);
    } else {
      map[userId] = nickname;
    }
    state = map;

    final list = map.entries.map((e) => '${e.key}:${e.value}').toList();
    await prefs.setStringList('chat_nicknames_$conversationId', list);
  }
}

final nicknamesProvider = StateNotifierProvider.family<NicknamesNotifier, Map<String, String>, String>((ref, conversationId) {
  return NicknamesNotifier(ref, conversationId);
});

class QuickReactionNotifier extends StateNotifier<String> {
  final Ref ref;
  final String conversationId;

  QuickReactionNotifier(this.ref, this.conversationId) : super('👍') {
    final prefs = ref.watch(sharedPreferencesProvider);
    state = prefs.getString('chat_quick_reaction_$conversationId') ?? '👍';
  }

  Future<void> setQuickReaction(String emoji) async {
    final prefs = ref.read(sharedPreferencesProvider);
    await prefs.setString('chat_quick_reaction_$conversationId', emoji);
    state = emoji;
  }
}

final quickReactionProvider = StateNotifierProvider.family<QuickReactionNotifier, String, String>((ref, conversationId) {
  return QuickReactionNotifier(ref, conversationId);
});
