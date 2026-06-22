import 'dart:async';
import 'dart:math';
import 'package:collection/collection.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/router/app_router.dart';
import '../../../core/utils/global_messenger.dart';
import '../data/chat_repository.dart';
import '../data/stomp_service.dart';
import '../../settings/ui/settings_screen.dart' show notificationsEnabledProvider;
import 'active_call_provider.dart';
import 'chat_misc_providers.dart';
import 'chat_state.dart';
import 'group_call_signaling.dart';
import 'webrtc_service.dart';

part 'conversations_notifier.g.dart';

// ---------------------------------------------------------------------------
// ConversationsNotifier — conversation list + realtime notification updates
// ---------------------------------------------------------------------------

@riverpod
class ConversationsNotifier extends _$ConversationsNotifier {
  StreamSubscription<Map<String, dynamic>>? _notifSub;
  StreamSubscription<ConversationModel>? _convUpdateSub;
  StreamSubscription<Map<String, dynamic>>? _webrtcSub;

  @override
  Future<List<ConversationModel>> build() async {
    final repo = ref.read(chatRepositoryProvider);
    final stomp = ref.read(stompServiceProvider.notifier);

    // Always disconnect first to ensure fresh token on login
    stomp.disconnect();
    const storage = FlutterSecureStorage();
    final token = await storage.read(key: 'accessToken');
    if (token != null) {
      await stomp.connect(token);
    }

    stomp.subscribeNotifications();

    _notifSub = stomp.notifications.listen(_onNotification);
    _convUpdateSub = stomp.conversationUpdates.listen(_onConversationUpdate);
    _webrtcSub = stomp.webrtcSignals.listen(_onWebRTCSignal);
    // Ensure group-call signaling + active-call tracking are live for the
    // whole session (call-ring + mesh signals + roster/started/ended events).
    ref.read(groupCallSignalingProvider);
    ref.read(activeCallsProvider);
    ref.onDispose(() {
      _notifSub?.cancel();
      _convUpdateSub?.cancel();
      _webrtcSub?.cancel();
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

  Future<void> toggleMuteConversation(String conversationId, bool isMuted) async {
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(current.map((c) {
        if (c.id == conversationId) {
          return c.copyWith(isMuted: isMuted);
        }
        return c;
      }).toList());
    }
    try {
      final repo = ref.read(chatRepositoryProvider);
      if (isMuted) {
        await repo.muteConversation(conversationId);
      } else {
        await repo.unmuteConversation(conversationId);
      }
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

  void _onWebRTCSignal(Map<String, dynamic> signal) {
    try {
      final type = signal['type'] as String?;
      // Group-call signals (call-ring + mesh offer/answer/ice carrying a
      // callId) are handled by GroupCallSignaling. Ignore them here so the
      // legacy 1-on-1 flow stays untouched.
      if (type == 'call-ring' || signal['callId'] != null) return;
      if (type == 'offer') {
        final senderId = signal['senderId'] as String?;
        final convId = signal['conversationId'] as String?;
        final sdp = signal['sdp'] as String?;
        if (senderId == null || convId == null || sdp == null) return;

        // Show incoming call dialog
        final router = ref.read(appRouterProvider);
        final context = router.routerDelegate.navigatorKey.currentContext;
        if (context == null) return;
        final l10n = context.l10n;

        // Resolve caller display name from local conversation state if available.
        final current = state.valueOrNull;
        String callerName = l10n.callUnknownCaller;
        final conv = current?.firstWhereOrNull((c) => c.id == convId);
        if (conv?.name != null) {
          callerName = conv!.name!;
        }

        showInAppNotification(
          l10n.callIncoming,
          l10n.callIncomingBody(callerName),
          onTap: () {
            router.push('/call', extra: {
              'targetId': senderId, // we reply back to sender
              'targetName': callerName,
              'conversationId': convId,
              'isCaller': false,
              'initialOfferSdp': sdp,
            });
          },
        );
      } else {
        // For answer, ice, end, we need to pass them to WebRTCService if it's active.
        final webrtc = ref.read(webRtcServiceProvider);
        if (type == 'answer') {
          final sdp = signal['sdp'] as String?;
          if (sdp == null) return;
          webrtc.handleAnswer(sdp);
        } else if (type == 'ice') {
          final candidate = signal['candidate'] as Map?;
          if (candidate == null) return;
          webrtc.handleIceCandidate(Map<String, dynamic>.from(candidate));
        } else if (type == 'end') {
          // Peer hung up: tear down locally only. Do NOT re-publish /app/call.end
          // or send a system call-log message — the hang-up initiator already
          // did both, otherwise we'd ping-pong and log the call twice.
          webrtc.dispose();
        }
      }
    } catch (e) {
      debugPrint('Malformed WebRTC signal ignored: $e');
      return;
    }
  }

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
      // Gate ONLY the visible banner on the user's notification preference.
      // Unread badge + conversation-list refresh below stay unaffected so
      // unread counts remain correct even when notifications are disabled.
      final notificationsEnabled = ref.read(notificationsEnabledProvider);
      final currentRoute = ref.read(appRouterProvider).routeInformationProvider.value.uri.path;
      if (notificationsEnabled && currentRoute != '/chat/$convId') {
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

      final updated = current.map((c) {
        if (c.id != convId) return c;
        return c.copyWith(
          lastMessageAt: DateTime.now(),
          unreadCount: c.unreadCount + 1,
          lastMessage: content != null
              ? LastMessageModel(
                  content: content,
                  senderId: senderId,
                  createdAt: DateTime.now(),
                )
              : c.lastMessage,
        );
      }).toList()
        ..sort((a, b) => (b.lastMessageAt ?? DateTime(0))
            .compareTo(a.lastMessageAt ?? DateTime(0)));
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
  }) async {
    String senderName = '';
    if (senderId.isNotEmpty) {
      try {
        final profile = await ref.read(userProfileProvider(senderId).future);
        senderName = profile.displayName;
      } catch (_) {}
    }

    final context =
        ref.read(appRouterProvider).routerDelegate.navigatorKey.currentContext;
    if (context == null || !context.mounted) return;
    final l10n = context.l10n;
    final name = senderName.isNotEmpty ? senderName : l10n.conversationDefault;

    String bodyText;
    if (isMention) {
      bodyText = l10n.mentionNotificationBody(name);
    } else {
      if (messageType == 'image') {
        bodyText = '$name: [${l10n.attachPhoto}]';
      } else if (messageType == 'video') {
        bodyText = '$name: [${l10n.attachVideo}]';
      } else if (messageType == 'file') {
        bodyText = '$name: [${l10n.attachFile}]';
      } else if (content != null && content.isNotEmpty) {
        bodyText = '$name: $content';
      } else {
        bodyText = l10n.newNotificationBody(name);
      }
    }

    showInAppNotification(
      isMention ? l10n.mentionNotificationTitle : l10n.newNotificationTitle,
      bodyText,
      onTap: () => ref.read(appRouterProvider).push('/chat/$convId'),
    );
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
