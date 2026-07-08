import 'dart:async';
import 'dart:math';
import 'package:collection/collection.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/api/token_manager.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/router/app_router.dart';
import '../../../core/utils/global_messenger.dart';
import '../data/chat_repository.dart';
import '../data/stomp_service.dart';
import '../../settings/ui/settings_screen.dart' show notificationsEnabledProvider;
import 'active_call_provider.dart';
import 'chat_misc_providers.dart';
import 'chat_state.dart';
import 'conversations_realtime_handlers.dart';
import 'group_call_signaling.dart';

part 'conversations_notifier.g.dart';

// ---------------------------------------------------------------------------
// ConversationsNotifier — conversation list + realtime notification updates
// ---------------------------------------------------------------------------

@riverpod
class ConversationsNotifier extends _$ConversationsNotifier {
  StreamSubscription<Map<String, dynamic>>? _notifSub;
  StreamSubscription<ConversationModel>? _convUpdateSub;
  StreamSubscription<Map<String, dynamic>>? _webrtcSub;
  StreamSubscription<void>? _reconnectSub;

  @override
  Future<List<ConversationModel>> build() async {
    final repo = ref.read(chatRepositoryProvider);
    final stomp = ref.read(stompServiceProvider.notifier);

    // Always disconnect first to ensure fresh token on login
    stomp.disconnect();
    // Obtain a FRESH, valid access token before connecting. Reading the raw
    // stored token here was the realtime/notification killer: an expired token
    // got CONNECT-rejected and the socket then auto-reconnected forever with
    // that same dead token. TokenManager refreshes (and persists the rotated
    // refresh token) if it's expiring. If there's genuinely no token / refresh
    // fails, skip connecting rather than loop on a dead token.
    final token = await TokenManager.shared.getValidAccessToken();
    if (token != null) {
      await stomp.connect(token);
    }

    stomp.subscribeNotifications();

    _notifSub = stomp.notifications.listen(_onNotification);
    _convUpdateSub = stomp.conversationUpdates.listen(_onConversationUpdate);
    _webrtcSub = stomp.webrtcSignals.listen(_onWebRTCSignal);
    // After a STOMP reconnect (e.g. app backgrounded → resumed), any
    // NEW_MESSAGE notifications that fired during the disconnect window were
    // never delivered. Silently refetch the list so unread badges + last
    // messages catch up without flashing a spinner.
    _reconnectSub = stomp.reconnects.listen((_) => _silentRefetch());
    // Ensure group-call signaling + active-call tracking are live for the
    // whole session (call-ring + mesh signals + roster/started/ended events).
    ref.read(groupCallSignalingProvider);
    ref.read(activeCallsProvider);
    ref.onDispose(() {
      _notifSub?.cancel();
      _convUpdateSub?.cancel();
      _webrtcSub?.cancel();
      _reconnectSub?.cancel();
    });

    return repo.listConversations();
  }

  void _onConversationUpdate(ConversationModel updated) {
    final current = state.valueOrNull;
    if (current == null) return;
    if (!current.any((c) => c.id == updated.id)) {
      // A group the user was just added to — pull it in.
      refresh();
      return;
    }
    state = AsyncData(current.map((c) {
      if (c.id != updated.id) return c;
      // Preserve list-only fields (unread/lastMessage) the event doesn't carry.
      return updated.copyWith(
        unreadCount: c.unreadCount,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
      );
    }).toList());
  }

  /// Hide a conversation locally + on the server.
  Future<void> deleteConversation(String conversationId) async {
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(
          current.where((c) => c.id != conversationId).toList());
    }
    try {
      await ref.read(chatRepositoryProvider).deleteConversation(conversationId);
    } catch (_) {
      // Roll back the optimistic removal without flashing the list to a spinner.
      await _silentRefetch();
    }
  }

  Future<void> toggleMuteConversation(String conversationId, bool isMuted,
      {int durationSeconds = -1}) async {
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(current.map((c) {
        if (c.id == conversationId) {
          return c.copyWith(isMuted: isMuted, clearMuteExpiresAt: !isMuted);
        }
        return c;
      }).toList());
    }
    try {
      final repo = ref.read(chatRepositoryProvider);
      if (isMuted) {
        final updated = await repo.muteConversation(
          conversationId,
          durationSeconds: durationSeconds,
        );
        final latest = state.valueOrNull;
        if (latest != null) {
          state = AsyncData(latest.map((c) {
            if (c.id == conversationId) {
              return c.copyWith(
                isMuted: updated.isMuted,
                muteExpiresAt: updated.muteExpiresAt,
              );
            }
            return c;
          }).toList());
        }
      } else {
        await repo.unmuteConversation(conversationId);
      }
    } catch (_) {
      await _silentRefetch();
    }
  }

  /// Block a user and archive-block the conversation.
  /// Auth-service block is handled by the caller (FriendsRepository.blockUser);
  /// this method only tells chat-service to block-archive the conversation.
  Future<void> blockAndArchiveConversation(String conversationId) async {
    // Optimistic: remove from main list immediately
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(
          current.where((c) => c.id != conversationId).toList());
    }
    try {
      await ref.read(chatRepositoryProvider).blockArchiveConversation(conversationId);
      ref.invalidate(blockedConversationsProvider);
    } catch (_) {
      await _silentRefetch();
    }
  }

  /// Unblock a user and restore the conversation from the Blocked section.
  /// Auth-service unblock is handled by the caller (FriendsRepository.unblockUser).
  Future<void> unblockAndRestoreConversation(String conversationId) async {
    try {
      await ref.read(chatRepositoryProvider).blockRestoreConversation(conversationId);
      ref.invalidate(blockedConversationsProvider);
      await _silentRefetch();
    } catch (_) {
      await _silentRefetch();
    }
  }

  Future<void> archiveConversation(String conversationId) async {
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(
          current.where((c) => c.id != conversationId).toList());
    }
    try {
      await ref.read(chatRepositoryProvider).archiveConversation(conversationId);
    } catch (_) {
      refresh();
    }
    ref.invalidate(archivedConversationsProvider);
  }

  /// Restores an archived conversation back into the main list.
  Future<void> unarchiveConversation(String conversationId) async {
    try {
      await ref
          .read(chatRepositoryProvider)
          .unarchiveConversation(conversationId);
    } catch (_) {
      // Even on failure, refresh both lists to reflect the true server state.
    }
    ref.invalidate(archivedConversationsProvider);
    await refresh();
  }

  Future<void> markConversationReadServer(String conversationId) async {
    markConversationRead(conversationId);
    try {
      await ref.read(chatRepositoryProvider).markConversationRead(conversationId);
    } catch (_) {
      await _silentRefetch();
    }
  }

  Future<void> markConversationUnreadServer(String conversationId) async {
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(current.map((c) {
        if (c.id == conversationId) {
          return c.copyWith(unreadCount: max(c.unreadCount, 1));
        }
        return c;
      }).toList());
    }
    try {
      await ref.read(chatRepositoryProvider).markConversationUnread(conversationId);
    } catch (_) {
      await _silentRefetch();
    }
  }

  void _onWebRTCSignal(Map<String, dynamic> signal) =>
      handleWebRtcSignal(ref, signal, state.valueOrNull);

  void _onNotification(Map<String, dynamic> notif) {
    final current = state.valueOrNull;
    if (current == null) return;

    // Chat-service gửi flat payload: {type, conversationId, senderName, senderId, content, messageType}
    final type = notif['type'] as String?;
    final bool isMention = type == 'MENTIONED_YOU';
    if (type == 'NEW_MESSAGE' || isMention) {
      final convId = notif['conversationId'] as String?;
      final senderId =
          (notif['senderId'] ?? notif['senderName'])?.toString() ?? '';
      if (convId == null) return;

      final content = notif['content'] as String?;
      final messageType = notif['messageType'] as String?;
      // Gate ONLY the visible banner on the user's notification preference AND
      // on whether the conversation is muted. Unread badge + conversation-list
      // refresh below stay unaffected so unread counts remain correct even when
      // notifications are disabled or the conversation is muted (parity with
      // web: muted = no banner/OS notification, but still counts as unread).
      final notificationsEnabled = ref.read(notificationsEnabledProvider);
      final isMuted =
          current.firstWhereOrNull((c) => c.id == convId)?.isMuted ?? false;
      final currentRoute = ref.read(appRouterProvider).routeInformationProvider.value.uri.path;
      if (notificationsEnabled && !isMuted && currentRoute != '/chat/$convId') {
        _showMessageBanner(
          convId: convId,
          senderId: senderId,
          isMention: isMention,
          content: content,
          messageType: messageType,
        );
      }

      if (!current.any((c) => c.id == convId)) {
        refresh();
        return;
      }

      // The conversation that just received a message always becomes the most
      // recent, so it moves to the front. Update it immutably and move-to-front
      // instead of re-sorting the whole list every message (avoids O(n log n)
      // churn — the rest of the list was already ordered, and prepending the
      // freshly-touched conversation preserves that ordering).
      final idx = current.indexWhere((c) => c.id == convId);
      if (idx < 0) {
        refresh();
        return;
      }
      final target = current[idx].copyWith(
        lastMessageAt: DateTime.now(),
        unreadCount: current[idx].unreadCount + 1,
        lastMessage: content != null
            ? LastMessageModel(
                content: content,
                senderId: senderId,
                createdAt: DateTime.now(),
              )
            : current[idx].lastMessage,
      );
      final updated = [
        target,
        for (int i = 0; i < current.length; i++)
          if (i != idx) current[i],
      ];
      state = AsyncData(updated);
    } else if (type == 'new_conversation') {
      refresh();
    } else if (type == 'RATE_LIMITED') {
      final context =
          ref.read(appRouterProvider).routerDelegate.navigatorKey.currentContext;
      showErrorSnackBar(context != null
          ? context.l10n.rateLimitError
          : 'Too many messages. Please slow down.');
    }
  }

  /// Resolves [senderId] to a display name then shows the top in-app banner.
  Future<void> _showMessageBanner({
    required String convId,
    required String senderId,
    required bool isMention,
    String? content,
    String? messageType,
  }) =>
      showIncomingMessageBanner(
        ref,
        convId: convId,
        senderId: senderId,
        isMention: isMention,
        content: content,
        messageType: messageType,
      );

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(chatRepositoryProvider).listConversations(),
    );
  }

  /// Re-fetch the conversation list WITHOUT flashing the whole list to a
  /// spinner. Used to roll back an optimistic update after a failed mutation:
  /// the current data stays on screen until the server response arrives.
  Future<void> _silentRefetch() async {
    final result = await AsyncValue.guard(
      () => ref.read(chatRepositoryProvider).listConversations(),
    );
    // Only replace on success; on failure keep the (optimistic) data rather
    // than surfacing an error over the whole list.
    if (result.hasValue) state = result;
  }

  void markConversationRead(String conversationId) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.map((c) {
      if (c.id == conversationId) return c.copyWith(unreadCount: 0);
      return c;
    }).toList());
  }
}
