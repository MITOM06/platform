import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/theme_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_state.dart';
import '../data/chat_repository.dart';
import 'chat_state.dart';
import 'conversations_notifier.dart';

// Lightweight providers + per-conversation customization StateNotifiers split
// out of chat_provider.dart (clean-code file limit). None use codegen.

final userStatusProvider =
    FutureProvider.autoDispose.family<UserStatus, String>((ref, userId) async {
  final link = ref.keepAlive();
  Timer(const Duration(minutes: 5), link.close);
  return ref.read(chatRepositoryProvider).getUserStatus(userId);
});

// Issue 1: peers must pick up a user's new avatar/display name reasonably
// quickly. Avatar URLs are unique-per-upload (auth-service stores a fresh
// `/api/uploads/<objectId>` path each time), so CachedNetworkImage fetches new
// bytes as soon as the resolved profile reports the new URL. The only thing
// gating that is this cache — shortened from 5 min to 60 s so a peer's avatar
// refreshes within a minute (mirrors the web client lowering its staleTime).
final userProfileProvider =
    FutureProvider.autoDispose.family<UserModel, String>((ref, userId) async {
  final link = ref.keepAlive();
  Timer(const Duration(seconds: 60), link.close);
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

/// Per-conversation wallpaper, now SERVER-shared (Issue 6).
///
/// The authoritative value lives on the Conversation document and arrives via
/// `CONVERSATION_UPDATED` (handled by [ConversationsNotifier]). This notifier
/// mirrors that value and supports an optimistic local override the moment the
/// user picks a wallpaper, so the UI updates before the server round-trips. The
/// optimistic value is reconciled away once the conversation list reports the
/// persisted wallpaper. Legacy `system.theme.changed:` messages still feed
/// [applyRemote] for backward compatibility with old history.
class ChatWallpaperNotifier extends StateNotifier<String?> {
  final Ref ref;
  final String conversationId;
  // While non-null, an optimistic value the user just selected that hasn't yet
  // been confirmed by the server-shared conversation model.
  String? _optimistic;

  ChatWallpaperNotifier(this.ref, this.conversationId)
      : super(_serverWallpaper(ref, conversationId)) {
    // Track the server-shared conversation: when its wallpaper changes (e.g. via
    // CONVERSATION_UPDATED), reflect it unless we hold a newer optimistic value.
    ref.listen<String?>(
      _conversationWallpaperProvider(conversationId),
      (_, next) {
        if (_optimistic != null && _optimistic == _normalize(next)) {
          _optimistic = null; // server caught up with our optimistic value
        }
        if (_optimistic == null) state = next;
      },
    );
  }

  static String? _serverWallpaper(Ref ref, String conversationId) {
    return ref.read(_conversationWallpaperProvider(conversationId));
  }

  static String? _normalize(String? v) => (v == null || v.isEmpty) ? null : v;

  /// Optimistically applies [url] locally and persists it on the server so all
  /// members share it. Empty / null resets to the default for everyone.
  Future<void> setWallpaper(String? url) async {
    final value = _normalize(url);
    _optimistic = value;
    state = value;
    try {
      await ref
          .read(chatRepositoryProvider)
          .setWallpaper(conversationId, value ?? '');
      // CONVERSATION_UPDATED (or the returned model via the list) reconciles.
    } catch (_) {
      // On failure, fall back to the server-shared value.
      _optimistic = null;
      state = _serverWallpaper(ref, conversationId);
    }
  }

  /// Applies a wallpaper value received out-of-band (legacy
  /// `system.theme.changed:` message). Server value remains authoritative.
  void applyRemote(String? url) {
    _optimistic = null;
    state = _normalize(url);
  }
}

/// Derives the wallpaper of a single conversation from the shared conversation
/// list, which [ConversationsNotifier] keeps fresh on CONVERSATION_UPDATED.
final _conversationWallpaperProvider =
    Provider.autoDispose.family<String?, String>((ref, conversationId) {
  final convs = ref.watch(conversationsNotifierProvider).valueOrNull;
  if (convs == null) return null;
  for (final c in convs) {
    if (c.id == conversationId) return c.wallpaper;
  }
  return null;
});

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
