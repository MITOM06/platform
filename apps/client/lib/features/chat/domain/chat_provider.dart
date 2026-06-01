import 'dart:async';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/router/app_router.dart';
import '../../../core/utils/global_messenger.dart';
import '../data/chat_repository.dart';
import '../data/stomp_service.dart';
import 'chat_state.dart';
import 'webrtc_service.dart';

part 'chat_provider.g.dart';

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
      refresh();
    }
  }

  void _onWebRTCSignal(Map<String, dynamic> signal) {
    final type = signal['type'] as String?;
    if (type == 'offer') {
      final senderId = signal['senderId'] as String;
      final convId = signal['conversationId'] as String;
      final sdp = signal['sdp'] as String;

      // Show incoming call dialog
      final router = ref.read(appRouterProvider);
      final context = router.routerDelegate.navigatorKey.currentContext;
      if (context == null) return;
      final l10n = context.l10n;

      // Resolve caller display name from local conversation state if available.
      final current = state.valueOrNull;
      String callerName = l10n.callUnknownCaller;
      if (current != null) {
        final conv = current.firstWhere((c) => c.id == convId, orElse: () => current.first);
        if (conv.name != null) {
          callerName = conv.name!;
        }
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
        webrtc.handleAnswer(signal['sdp'] as String);
      } else if (type == 'ice') {
        webrtc.handleIceCandidate(signal['candidate'] as Map<String, dynamic>);
      } else if (type == 'end') {
        webrtc.endCall(duration: 0);
      }
    }
  }

  void _onNotification(Map<String, dynamic> notif) {
    final current = state.valueOrNull;
    if (current == null) return;

    // Chat-service gửi flat payload: {type, conversationId, senderName, senderId}
    final type = notif['type'] as String?;
    final bool isMention = type == 'MENTIONED_YOU';
    if (type == 'NEW_MESSAGE' || isMention) {
      final convId = notif['conversationId'] as String?;
      final senderName = notif['senderName'] ?? 'Ai đó';
      if (convId == null) return;

      // Check if user is currently inside this chat screen.
      // If we are, ChatNotifier(convId) is alive. But we can just use router state.
      // A simpler heuristic: if the route is /chat/:id, we are inside.
      final currentRoute = ref.read(appRouterProvider).routeInformationProvider.value.uri.path;
      if (currentRoute != '/chat/$convId') {
        final context =
            ref.read(appRouterProvider).routerDelegate.navigatorKey.currentContext;
        // Mentions get a distinct, higher-signal in-app banner.
        showInAppNotification(
          isMention
              ? (context != null ? context.l10n.mentionNotificationTitle : 'Mentioned you')
              : "Tin nhắn mới",
          isMention
              ? (context != null
                  ? context.l10n.mentionNotificationBody(senderName.toString())
                  : "$senderName mentioned you")
              : "$senderName đã nhắn tin cho bạn.",
          onTap: () {
            ref.read(appRouterProvider).push('/chat/$convId');
          },
        );
      }

      // Conversation chưa có trong list (vd: người khác vừa tạo phòng mới với
      // mình) → fetch lại để nó xuất hiện ngay thay vì phải reload thủ công.
      if (!current.any((c) => c.id == convId)) {
        refresh();
        return;
      }

      // Đẩy conversation lên đầu + tăng unreadCount
      final updated = current.map((c) {
        if (c.id != convId) return c;
        return c.copyWith(
          lastMessageAt: DateTime.now(),
          unreadCount: c.unreadCount + 1,
        );
      }).toList()
        ..sort((a, b) => (b.lastMessageAt ?? DateTime(0))
            .compareTo(a.lastMessageAt ?? DateTime(0)));
      state = AsyncData(updated);
    } else if (type == 'new_conversation') {
      refresh();
    }
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(chatRepositoryProvider).listConversations(),
    );
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

// ---------------------------------------------------------------------------
// ChatNotifier — messages for a single conversation
// ---------------------------------------------------------------------------

@riverpod
class ChatNotifier extends _$ChatNotifier {
  Timer? _typingTimer;
  final Map<String, Timer> _typingTimers = {};
  StreamSubscription<MessageModel>? _messageSub;
  StreamSubscription<TypingEvent>? _typingSub;
  StreamSubscription<ReadReceiptEvent>? _readSub;
  StreamSubscription<ReactionUpdateEvent>? _reactionSub;
  StreamSubscription<RecallEvent>? _recallSub;
  StreamSubscription<MessageUpdateEvent>? _editSub;

  @override
  Future<ChatState> build(String conversationId) async {
    final stomp = ref.read(stompServiceProvider.notifier);

    stomp.subscribeConversation(conversationId);

    _messageSub = stomp.messages
        .where((m) => m.conversationId == conversationId)
        .listen(_onNewMessage);

    _typingSub = stomp.typing
        .where((e) => e.conversationId == conversationId)
        .listen(_onTypingEvent);

    _readSub = stomp.readReceipts
        .where((e) => e.conversationId == conversationId)
        .listen(_onReadReceipt);

    _reactionSub = stomp.reactionUpdates
        .where((e) => e.conversationId == conversationId)
        .listen(_onReactionUpdate);

    _recallSub = stomp.recalledMessages
        .where((e) => e.conversationId == conversationId)
        .listen(_onRecall);

    _editSub = stomp.editedMessages
        .where((e) => e.conversationId == conversationId)
        .listen(_onEdit);

    ref.onDispose(() {
      _messageSub?.cancel();
      _typingSub?.cancel();
      _readSub?.cancel();
      _reactionSub?.cancel();
      _recallSub?.cancel();
      _editSub?.cancel();
      _typingTimer?.cancel();
      for (final t in _typingTimers.values) {
        t.cancel();
      }
      _typingTimers.clear();
      stomp.unsubscribeConversation(conversationId);
    });

    // API returns DESC (newest first) — use directly with ListView(reverse: true)
    final paged =
        await ref.read(chatRepositoryProvider).getMessages(conversationId, size: 20);
    // On entry, persist read state on the server for messages that arrived while
    // we were away. The local unread badge is already reset by
    // ConversationsNotifier.markConversationRead, but without this the badge would
    // reappear after the next list reload (server recomputes unreadCount).
    _markLoadedAsRead(paged.content);
    return ChatState(
      messages: paged.content,
      hasMore: paged.hasNext,
    );
  }

  void _markLoadedAsRead(List<MessageModel> messages) {
    final uid = _currentUserId;
    if (uid == null) return;
    final stomp = ref.read(stompServiceProvider.notifier);
    final repo = ref.read(chatRepositoryProvider);
    for (final m in messages) {
      if (m.senderId != uid && !m.readBy.contains(uid)) {
        if (stomp.isConnected) {
          stomp.sendRead(conversationId, m.id);
        } else {
          repo.markAsRead(m.id).ignore();
        }
      }
    }
  }

  void _onNewMessage(MessageModel message) {
    final current = state.valueOrNull;
    if (current == null) return;

    // Replace optimistic message if one matches by senderId + content
    final pendingIdx = current.messages.indexWhere(
      (m) =>
          m.isPending &&
          m.senderId == message.senderId &&
          m.content == message.content,
    );

    final List<MessageModel> updated;
    if (pendingIdx != -1) {
      updated = List.from(current.messages)..[pendingIdx] = message;
    } else {
      updated = [message, ...current.messages];
    }

    state = AsyncData(current.copyWith(messages: updated));

    // Mark messages from others as read. Prefer STOMP so the server broadcasts
    // a MESSAGE_READ event (sender sees the tick update live); fall back to REST
    // when the socket is down.
    if (message.senderId != _currentUserId) {
      final stomp = ref.read(stompServiceProvider.notifier);
      if (stomp.isConnected) {
        stomp.sendRead(conversationId, message.id);
      } else {
        ref.read(chatRepositoryProvider).markAsRead(message.id).ignore();
      }
    }
  }

  void _onReadReceipt(ReadReceiptEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;

    final updated = current.messages.map((m) {
      if (m.id == event.messageId && !m.readBy.contains(event.readerId)) {
        return m.copyWith(readBy: [...m.readBy, event.readerId]);
      }
      return m;
    }).toList();

    state = AsyncData(current.copyWith(messages: updated));
  }

  void _onReactionUpdate(ReactionUpdateEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    final updated = current.messages
        .map((m) => m.id == event.messageId
            ? m.copyWith(reactions: event.reactions)
            : m)
        .toList();
    state = AsyncData(current.copyWith(messages: updated));
  }

  void _onRecall(RecallEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    final updated = current.messages
        .map((m) => m.id == event.messageId
            ? m.copyWith(recalled: true, content: '', reactions: const [])
            : m)
        .toList();
    state = AsyncData(current.copyWith(messages: updated));
  }

  void _onEdit(MessageUpdateEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    final updated = current.messages
        .map((m) => m.id == event.messageId
            ? m.copyWith(content: event.content, editedAt: event.editedAt)
            : m)
        .toList();
    state = AsyncData(current.copyWith(messages: updated));
  }

  // ----- Reply / reactions / recall / delete actions --------------------

  void startReply(MessageModel message) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(replyingTo: message));
  }

  void cancelReply() {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(clearReplyingTo: true));
  }

  /// Begin editing a sent message — the composer pre-fills with its content.
  /// Editing and replying are mutually exclusive.
  void startEditing(MessageModel message) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(
        current.copyWith(editingMessage: message, clearReplyingTo: true));
  }

  void cancelEditing() {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(clearEditingMessage: true));
  }

  /// Toggle a reaction: tapping the same emoji again removes it.
  Future<void> toggleReaction(String messageId, String emoji) async {
    final current = state.valueOrNull;
    final uid = _currentUserId;
    if (current == null || uid == null) return;
    final matches = current.messages.where((m) => m.id == messageId);
    final msg = matches.isEmpty ? null : matches.first;
    final alreadySame = msg != null &&
        msg.reactions.any((r) => r.userId == uid && r.emoji == emoji);
    final repo = ref.read(chatRepositoryProvider);
    try {
      if (alreadySame) {
        await repo.removeReaction(messageId);
      } else {
        await repo.addReaction(messageId, emoji);
      }
    } catch (_) {
      // Realtime REACTION_UPDATED broadcast keeps state authoritative.
    }
  }

  Future<void> recallMessage(String messageId) async {
    try {
      await ref.read(chatRepositoryProvider).recallMessage(messageId);
    } catch (_) {}
  }

  /// Edit a sent message. Optimistically updates locally; the server's
  /// MESSAGE_UPDATED broadcast keeps both peers authoritative.
  Future<void> editMessage(String messageId, String content) async {
    final trimmed = content.trim();
    if (trimmed.isEmpty) return;
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(current.copyWith(
        messages: current.messages
            .map((m) => m.id == messageId
                ? m.copyWith(content: trimmed, editedAt: DateTime.now())
                : m)
            .toList(),
        clearEditingMessage: true,
      ));
    }
    try {
      await ref.read(chatRepositoryProvider).editMessage(messageId, trimmed);
    } catch (_) {
      // Broadcast / next reload reconciles on failure.
    }
  }

  /// Ensure [messageId] is loaded (paging older history if needed), then mark it
  /// as the highlight target so the UI can scroll to it (Task 50 search jump).
  Future<void> jumpToMessage(String messageId) async {
    // Page back until the target is loaded, capped so we never loop forever.
    for (int i = 0; i < 20; i++) {
      final current = state.valueOrNull;
      if (current == null) return;
      if (current.messages.any((m) => m.id == messageId)) break;
      if (!current.hasMore) break;
      await loadMore();
    }
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(highlightMessageId: messageId));
  }

  void clearHighlight() {
    final current = state.valueOrNull;
    if (current == null || current.highlightMessageId == null) return;
    state = AsyncData(current.copyWith(clearHighlight: true));
  }

  Future<void> deleteForMe(String messageId) async {
    final current = state.valueOrNull;
    if (current == null) return;
    // Optimistically remove from this device.
    state = AsyncData(current.copyWith(
      messages: current.messages.where((m) => m.id != messageId).toList(),
    ));
    try {
      await ref.read(chatRepositoryProvider).deleteMessageForMe(messageId);
    } catch (_) {}
  }

  void _onTypingEvent(TypingEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    final typingIds = Set<String>.from(current.typingUserIds);

    _typingTimers[event.userId]?.cancel();

    if (event.isTyping) {
      typingIds.add(event.userId);
      _typingTimers[event.userId] = Timer(const Duration(seconds: 3), () {
        _removeTypingUser(event.userId);
      });
    } else {
      typingIds.remove(event.userId);
      _typingTimers.remove(event.userId);
    }

    state = AsyncData(current.copyWith(typingUserIds: typingIds));
  }

  void _removeTypingUser(String userId) {
    final current = state.valueOrNull;
    if (current == null) return;
    final typingIds = Set<String>.from(current.typingUserIds)..remove(userId);
    _typingTimers.remove(userId);
    state = AsyncData(current.copyWith(typingUserIds: typingIds));
  }

  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || !current.hasMore || current.isLoadingMore) return;

    state = AsyncData(current.copyWith(isLoadingMore: true));

    // Cursor = oldest real (non-pending) message id. The list is newest-first,
    // so iterating to the end leaves `before` pointing at the oldest message.
    String? before;
    for (final m in current.messages) {
      if (!m.isPending) before = m.id;
    }

    try {
      final paged = await ref.read(chatRepositoryProvider).getMessages(
            conversationId,
            before: before,
            size: 20,
          );
      final fresh = state.valueOrNull ?? current;
      // Guard against id overlap if a realtime message arrived mid-fetch.
      final existingIds = fresh.messages.map((m) => m.id).toSet();
      final older =
          paged.content.where((m) => !existingIds.contains(m.id)).toList();
      state = AsyncData(fresh.copyWith(
        messages: [...fresh.messages, ...older],
        hasMore: paged.hasNext,
        isLoadingMore: false,
      ));
    } catch (_) {
      final fresh = state.valueOrNull ?? current;
      state = AsyncData(fresh.copyWith(isLoadingMore: false));
    }
  }

  Future<void> sendMessage(String content, {String type = 'text'}) async {
    final current = state.valueOrNull;
    if (current == null) return;

    final uid = _currentUserId;
    if (uid == null) return;

    final replyTo = current.replyingTo;
    final replyPreview = replyTo == null
        ? null
        : ReplyPreview(
            messageId: replyTo.id,
            senderId: replyTo.senderId,
            content: replyTo.content,
          );

    final optimistic = MessageModel(
      id: 'pending_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: conversationId,
      senderId: uid,
      content: content,
      type: type,
      readBy: [uid],
      createdAt: DateTime.now(),
      replyToId: replyTo?.id,
      replyPreview: replyPreview,
      isPending: true,
    );

    // Adding the message also clears the reply composer.
    state = AsyncData(current.copyWith(
      messages: [optimistic, ...current.messages],
      clearReplyingTo: true,
    ));

    final stomp = ref.read(stompServiceProvider.notifier);
    if (stomp.isConnected) {
      stomp.sendMessage(conversationId, content,
          type: type, replyToId: replyTo?.id);
    } else {
      // REST fallback when STOMP unavailable
      try {
        final sent = await ref
            .read(chatRepositoryProvider)
            .sendMessageRest(conversationId, content,
                type: type, replyToId: replyTo?.id);
        final c = state.valueOrNull;
        if (c != null) {
          state = AsyncData(c.copyWith(
            messages: c.messages
                .map((m) => m.id == optimistic.id ? sent : m)
                .toList(),
          ));
        }
      } catch (_) {
        final c = state.valueOrNull;
        if (c != null) {
          state = AsyncData(c.copyWith(
            messages: c.messages.where((m) => m.id != optimistic.id).toList(),
          ));
        }
      }
    }
  }

  void startTyping() {
    final stomp = ref.read(stompServiceProvider.notifier);
    stomp.sendTyping(conversationId, isTyping: true);
    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 3), () {
      stomp.sendTyping(conversationId, isTyping: false);
    });
  }

  String? get _currentUserId {
    final auth = ref.read(authNotifierProvider).valueOrNull;
    return auth is AuthAuthenticated ? auth.user.id : null;
  }
}

final userStatusProvider =
    FutureProvider.autoDispose.family<UserStatus, String>((ref, userId) {
  return ref.read(chatRepositoryProvider).getUserStatus(userId);
});

final userProfileProvider =
    FutureProvider.autoDispose.family<UserModel, String>((ref, userId) {
  return ref.read(authRepositoryProvider).getUserProfile(userId);
});

/// Fetches Open Graph metadata for a URL (cached per-url for the screen's life).
final linkPreviewProvider =
    FutureProvider.autoDispose.family<LinkPreviewData, String>((ref, url) {
  return ref.read(chatRepositoryProvider).fetchLinkPreview(url);
});
