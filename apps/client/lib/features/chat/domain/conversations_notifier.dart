import 'dart:async';
import 'dart:math';
import 'package:collection/collection.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/api/token_manager.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/router/app_router.dart';
import '../../../core/utils/global_messenger.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../home/domain/home_providers.dart';
import '../data/chat_repository.dart';
import '../data/stomp_service.dart';
import '../../settings/ui/settings_screen.dart' show notificationsEnabledProvider;
import 'active_call_provider.dart';
import 'chat_misc_providers.dart';
import 'chat_state.dart';
import 'conversation_list_ops.dart';
import 'conversations_realtime_handlers.dart';
import 'group_call_signaling.dart';
import '../../meetings/state/meeting_queue_listener.dart';

part 'conversations_notifier.g.dart';

// ---------------------------------------------------------------------------
// ConversationsNotifier — conversation list + realtime notification updates
// ---------------------------------------------------------------------------

@riverpod
class ConversationsNotifier extends _$ConversationsNotifier {
  StreamSubscription<Map<String, dynamic>>? _notifSub;
  StreamSubscription<ConversationUpdateEvent>? _convUpdateSub;
  StreamSubscription<Map<String, dynamic>>? _webrtcSub;
  StreamSubscription<void>? _reconnectSub;
  bool _claimsRefreshRunning = false;

  @override
  Future<List<ConversationModel>> build() async {
    final repo = ref.read(chatRepositoryProvider);
    final stomp = ref.read(stompServiceProvider.notifier);

    // Always disconnect first to ensure fresh token on login
    stomp.disconnect();
    // Obtain a FRESH, valid access token before connecting (an expired one got
    // CONNECT-rejected and the socket then looped on it). If there's genuinely
    // no token / refresh fails, skip connecting rather than loop.
    final token = await TokenManager.shared.getValidAccessToken();
    if (token != null) {
      await stomp.connect(token);
    }

    stomp.subscribeNotifications();

    _notifSub = stomp.notifications.listen(_onNotification);
    _convUpdateSub = stomp.conversationUpdates.listen(_onConversationUpdate);
    _webrtcSub = stomp.webrtcSignals.listen(_onWebRTCSignal);
    // After a STOMP reconnect any NEW_MESSAGE notification fired during the
    // gap was lost. Silently refetch so unread badges + previews catch up.
    _reconnectSub = stomp.reconnects.listen((_) => _silentRefetch());
    // Ensure group-call signaling + active-call tracking are live for the
    // whole session (call-ring + mesh signals + roster/started/ended events).
    ref.read(groupCallSignalingProvider);
    ref.read(activeCallsProvider);
    // Personal meeting queue (invitations, reminders, lobby, …).
    ref.read(meetingQueueListenerProvider);
    ref.onDispose(() {
      _notifSub?.cancel();
      _convUpdateSub?.cancel();
      _webrtcSub?.cancel();
      _reconnectSub?.cancel();
    });

    return repo.listConversations();
  }

  String? get _currentUserId {
    final auth = ref.read(authNotifierProvider).valueOrNull;
    return auth is AuthAuthenticated ? auth.user.id : null;
  }

  /// Merges a CONVERSATION_UPDATED (shared topic payload or the actor's own
  /// full view) into the list — never replacing it wholesale.
  void _onConversationUpdate(ConversationUpdateEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    final result = ConversationListOps.merge(
      current,
      event,
      currentUserId: _currentUserId,
    );
    switch (result.outcome) {
      case ConversationMergeOutcome.ignored:
        return;
      case ConversationMergeOutcome.updated:
        state = AsyncData(result.conversations);
        if (event.personal) {
          // Archive / block moves it between sections.
          ref.invalidate(archivedConversationsProvider);
          ref.invalidate(blockedConversationsProvider);
        }
      case ConversationMergeOutcome.removedMe:
        state = AsyncData(result.conversations);
        final id = result.conversationId;
        if (id != null) leaveRemovedConversation(ref, id);
      case ConversationMergeOutcome.unknown:
        // A group the user was just added to, a conversation restored on
        // another device, or one beyond the loaded page — pull it in.
        final id = result.conversationId;
        if (id != null) unawaited(ensureLoaded(id));
        if (event.personal) ref.invalidate(archivedConversationsProvider);
    }
  }

  /// Makes sure [conversationId] is in the list (e.g. opened from a push or a
  /// link while it is beyond the loaded page), so the chat header, composer
  /// and realtime merges work for it like for any other conversation.
  Future<void> ensureLoaded(String conversationId) async {
    final List<ConversationModel> list;
    try {
      list = await future;
    } catch (_) {
      return;
    }
    if (list.any((c) => c.id == conversationId)) return;
    try {
      final conv =
          await ref.read(chatRepositoryProvider).getConversation(conversationId);
      final latest = state.valueOrNull;
      if (latest == null) return;
      final me = _currentUserId;
      if (me != null && !conv.participants.contains(me)) return;
      state = AsyncData(ConversationListOps.upsertSorted(latest, conv));
    } catch (_) {
      // Not accessible (removed / deleted) — nothing to add.
    }
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
      final updated = isMuted
          ? await repo.muteConversation(conversationId,
              durationSeconds: durationSeconds)
          : await repo.unmuteConversation(conversationId);
      _replace(updated);
    } catch (_) {
      await _silentRefetch();
    }
  }

  /// Applies a conversation returned by a REST mutation (the caller's full
  /// view) — group settings, admins, auto-delete — without waiting for the
  /// realtime echo.
  void applyServerCopy(ConversationModel conv) => _replace(conv);

  /// Replaces [conv] in the list with a REST response (which carries the
  /// caller's full view).
  void _replace(ConversationModel conv) {
    final latest = state.valueOrNull;
    if (latest == null) return;
    state = AsyncData([
      for (final c in latest) c.id == conv.id ? conv : c,
    ]);
  }

  /// Block a user and archive-block the conversation.
  /// Auth-service block is handled by the caller (FriendsRepository.blockUser);
  /// this method only tells chat-service to block-archive the conversation.
  Future<void> blockAndArchiveConversation(String conversationId) async {
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
      await _silentRefetch();
    }
    ref.invalidate(archivedConversationsProvider);
  }

  /// Restores an archived conversation back into the main list.
  Future<void> unarchiveConversation(String conversationId) async {
    try {
      final restored = await ref
          .read(chatRepositoryProvider)
          .unarchiveConversation(conversationId);
      final latest = state.valueOrNull;
      if (latest != null) {
        state = AsyncData(ConversationListOps.upsertSorted(latest, restored));
      }
    } catch (_) {
      await _silentRefetch();
    }
    ref.invalidate(archivedConversationsProvider);
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

  /// Whether the user is looking at [conversationId] right now (mobile route
  /// or the wide-layout detail pane).
  bool _isViewing(String conversationId) {
    final path =
        ref.read(appRouterProvider).routeInformationProvider.value.uri.path;
    return path == '/chat/$conversationId' ||
        ref.read(selectedConversationIdProvider) == conversationId;
  }

  void _onNotification(Map<String, dynamic> notif) {
    final type = notif['type'] as String?;
    switch (type) {
      case 'NEW_MESSAGE':
      case 'MENTIONED_YOU':
        _onIncomingMessage(notif, isMention: type == 'MENTIONED_YOU');
      case 'new_conversation':
        unawaited(_silentRefetch());
      case 'CLAIMS_CHANGED':
        if (!_claimsRefreshRunning) {
          _claimsRefreshRunning = true;
          unawaited(refreshClaims(ref)
              .whenComplete(() => _claimsRefreshRunning = false));
        }
      case 'RATE_LIMITED':
        final context =
            ref.read(appRouterProvider).routerDelegate.navigatorKey.currentContext;
        if (context != null) showErrorSnackBar(context.l10n.rateLimitError);
    }
  }

  void _onIncomingMessage(Map<String, dynamic> notif, {required bool isMention}) {
    final current = state.valueOrNull;
    if (current == null) return;
    // Chat-service sends a flat payload:
    // {type, conversationId, senderName, senderId, content, messageType}.
    final convId = notif['conversationId'] as String?;
    if (convId == null) return;
    final senderId =
        (notif['senderId'] ?? notif['senderName'])?.toString() ?? '';
    final content = notif['content'] as String?;
    final messageType = notif['messageType'] as String?;
    final viewing = _isViewing(convId);

    // Gate ONLY the visible banner on the notification preference AND the
    // conversation's mute state; unread + preview still update (parity with
    // web: muted = no banner/OS notification, but still counts as unread).
    final notificationsEnabled = ref.read(notificationsEnabledProvider);
    final isMuted =
        current.firstWhereOrNull((c) => c.id == convId)?.isMuted ?? false;
    if (notificationsEnabled && !isMuted && !viewing) {
      unawaited(showIncomingMessageBanner(
        ref,
        convId: convId,
        senderId: senderId,
        isMention: isMention,
        senderName: notif['senderName'] as String?,
        content: content,
        messageType: messageType,
      ));
    }

    final createdAt = notif['createdAt'];
    final updated = ConversationListOps.applyIncomingMessage(
      current,
      conversationId: convId,
      senderId: senderId,
      viewing: viewing,
      content: content,
      messageType: messageType,
      messageId: notif['messageId'] as String?,
      createdAt: createdAt is String ? DateTime.tryParse(createdAt) : null,
    );
    if (updated == null) {
      unawaited(ensureLoaded(convId));
      return;
    }
    state = AsyncData(updated);
  }

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
