import 'dart:async';

import 'package:collection/collection.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../chat/data/chat_repository.dart';
import '../../chat/data/stomp_service.dart';
import '../../chat/domain/chat_state.dart';
import '../../chat/domain/conversation_list_ops.dart';
import '../../../core/router/app_router.dart';
import '../../home/domain/home_providers.dart';
import '../data/ai_thread_repository.dart';

/// Whether the user is looking at conversation `id` right now (mobile route
/// or wide-layout detail pane). Overridable in tests.
final aiThreadViewingProvider = Provider<bool Function(String id)>((ref) {
  return (id) {
    final path =
        ref.read(appRouterProvider).routeInformationProvider.value.uri.path;
    return path == '/chat/$id' || ref.read(selectedConversationIdProvider) == id;
  };
});

/// The caller's AI threads, newest activity first. Kept current from realtime
/// (mirror of web `['ai-threads']` cache): the main conversation list never
/// holds them.
final aiThreadsProvider =
    AsyncNotifierProvider<AiThreadsNotifier, List<ConversationModel>>(
        AiThreadsNotifier.new);

class AiThreadsNotifier extends AsyncNotifier<List<ConversationModel>> {
  @override
  Future<List<ConversationModel>> build() async {
    final stomp = ref.read(stompServiceProvider.notifier);
    final subs = <StreamSubscription<Object?>>[
      stomp.conversationUpdates.listen(_onConversationUpdate),
      stomp.notifications.listen(_onNotification),
      // Notifications fired during a socket gap were lost: catch up.
      stomp.reconnects.listen((_) => unawaited(_silentRefetch())),
    ];
    ref.onDispose(() {
      for (final s in subs) {
        s.cancel();
      }
    });
    return ref.read(aiThreadRepositoryProvider).list();
  }

  String? get _currentUserId {
    final auth = ref.read(authNotifierProvider).valueOrNull;
    return auth is AuthAuthenticated ? auth.user.id : null;
  }

  /// Creates a thread and puts it on top.
  Future<ConversationModel> create() async {
    final conv = await ref.read(aiThreadRepositoryProvider).create();
    // The initial load may still be running: wait so the thread isn't dropped.
    try {
      await future;
    } catch (_) {}
    _setList((l) => ConversationListOps.upsertFront(l, conv));
    return conv;
  }

  /// Renames a thread in place (position kept).
  Future<ConversationModel> rename(String id, String name) async {
    final conv = await ref.read(aiThreadRepositoryProvider).rename(id, name);
    _setList((l) => [for (final c in l) c.id == id ? conv : c]);
    return conv;
  }

  /// Hides a thread for me (existing per-user delete). Optimistic; on failure
  /// the list is refetched and the error rethrown for the caller to show.
  Future<void> delete(String id) async {
    _setList((l) => l.where((c) => c.id != id).toList());
    try {
      await ref.read(chatRepositoryProvider).deleteConversation(id);
    } catch (_) {
      await _silentRefetch();
      rethrow;
    }
  }

  /// Newest thread, creating the first one when there are none. Always asks
  /// the server (a stale cache must not hide a thread made elsewhere).
  Future<ConversationModel> newestOrCreate() async {
    final threads = await ref.read(aiThreadRepositoryProvider).list();
    state = AsyncData(threads);
    final first = threads.firstOrNull;
    return first ?? await create();
  }

  /// Puts [conv] into the list (once loaded).
  void upsert(ConversationModel conv) {
    if (!conv.isAiConversation) return;
    void apply() => _setList((l) => l.any((c) => c.id == conv.id)
        ? [for (final c in l) c.id == conv.id ? conv : c]
        : ConversationListOps.upsertFront(l, conv));
    if (state.hasValue) {
      apply();
    } else {
      // Not loaded yet (e.g. opened from a push before the hub): apply once
      // it is; replace-or-insert is idempotent if the fetch already has it.
      future.then((_) => apply(), onError: (_) {});
    }
  }

  bool contains(String id) =>
      state.valueOrNull?.any((c) => c.id == id) ?? false;

  void _setList(List<ConversationModel> Function(List<ConversationModel>) fn) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(fn(current));
  }

  Future<void> _silentRefetch() async {
    final result = await AsyncValue.guard(
        () => ref.read(aiThreadRepositoryProvider).list());
    if (result.hasValue) state = result;
  }

  void _onConversationUpdate(ConversationUpdateEvent event) {
    final id = event.conversationId;
    final participants = event.json['participants'];
    if (id == null ||
        participants is! List ||
        !participants.contains(kAiBotUserId)) {
      return;
    }
    final me = _currentUserId;
    if (me != null && !participants.contains(me)) {
      _setList((l) => l.where((c) => c.id != id).toList());
      return;
    }
    final current = state.valueOrNull;
    if (current == null) return;
    final idx = current.indexWhere((c) => c.id == id);
    if (idx < 0) {
      if (event.personal) {
        // A thread made on another device / by POST: insert at the top.
        _setList((l) => ConversationListOps.upsertFront(
            l, ConversationModel.fromJson(event.json)));
      } else {
        unawaited(_silentRefetch());
      }
      return;
    }
    final merged = current[idx].mergeJson(event.json);
    if (event.personal) {
      _setList((l) => [for (final c in l) c.id == id ? merged : c]);
    } else {
      _setList((l) => ConversationListOps.upsertSorted(
          l.where((c) => c.id != id).toList(), merged));
    }
  }

  void _onNotification(Map<String, dynamic> notif) {
    final type = notif['type'];
    if (type != 'NEW_MESSAGE' && type != 'MENTIONED_YOU') return;
    final notice = IncomingMessageNotice.fromJson(notif);
    final current = state.valueOrNull;
    if (notice == null || current == null) return;
    final conv = current.firstWhereOrNull((c) => c.id == notice.conversationId);
    if (conv == null) return;
    if (notice.messageId != null && conv.lastMessage?.messageId == notice.messageId) {
      return;
    }
    final updated = ConversationListOps.applyIncomingMessage(
      current,
      conversationId: notice.conversationId,
      senderId: notice.senderId,
      viewing: ref.read(aiThreadViewingProvider)(notice.conversationId),
      content: notice.content,
      messageType: notice.messageType,
      messageId: notice.messageId,
      createdAt: notice.createdAt,
    );
    if (updated != null) state = AsyncData(updated);
  }
}
