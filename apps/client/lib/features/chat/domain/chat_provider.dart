import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../core/providers/theme_provider.dart';
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
      refresh();
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
      refresh();
    }
  }

  Future<void> markConversationUnreadServer(String conversationId) async {
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(current.map((c) {
        if (c.id == conversationId) return c.copyWith(unreadCount: 1);
        return c;
      }).toList());
    }
    try {
      await ref.read(chatRepositoryProvider).markConversationUnread(conversationId);
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

    // Chat-service gửi flat payload: {type, conversationId, senderName, senderId, content, messageType}
    final type = notif['type'] as String?;
    final bool isMention = type == 'MENTIONED_YOU';
    if (type == 'NEW_MESSAGE' || isMention) {
      final convId = notif['conversationId'] as String?;
      final senderId =
          (notif['senderId'] ?? notif['senderName'])?.toString() ?? '';
      if (convId == null) return;

      final currentRoute = ref.read(appRouterProvider).routeInformationProvider.value.uri.path;
      if (currentRoute != '/chat/$convId') {
        final content = notif['content'] as String?;
        final messageType = notif['messageType'] as String?;
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
  StreamSubscription<PinnedMessageEvent>? _pinSub;
  StreamSubscription<void>? _reconnectSub;
  StreamSubscription<Map<String, dynamic>>? _aiStreamSub;

  /// Message ids with a reaction request in flight. Guards against rapid
  /// repeated double-taps spamming the server with add/remove churn before the
  /// authoritative REACTION_UPDATED broadcast lands.
  final Set<String> _reactionInFlight = {};

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

    _pinSub = stomp.pinnedMessageUpdates
        .where((e) => e.conversationId == conversationId)
        .listen(_onPinnedMessage);

    _reconnectSub = stomp.reconnects.listen((_) => _catchupMessages());

    _aiStreamSub = stomp.aiStreamEvents.listen(_onAiStreamEvent);

    ref.onDispose(() {
      _messageSub?.cancel();
      _typingSub?.cancel();
      _readSub?.cancel();
      _reactionSub?.cancel();
      _recallSub?.cancel();
      _editSub?.cancel();
      _pinSub?.cancel();
      _reconnectSub?.cancel();
      _aiStreamSub?.cancel();
      _typingTimer?.cancel();
      for (final t in _typingTimers.values) {
        t.cancel();
      }
      _typingTimers.clear();
      stomp.unsubscribeConversation(conversationId);
    });

    final repo = ref.read(chatRepositoryProvider);
    // Fetch messages and conversation in parallel for initial load.
    final results = await Future.wait([
      repo.getMessages(conversationId, size: 20),
      repo.getConversation(conversationId),
    ]);
    final paged = results[0] as PagedResult<MessageModel>;
    final conv = results[1] as ConversationModel;
    _markLoadedAsRead(paged.content);

    // Parse historical system messages for config (theme, nickname, quick reaction)
    for (final m in paged.content.reversed) {
      if (m.isSystem) {
        final content = m.content;
        if (content.startsWith('system.nickname.changed:')) {
          final parts = content.split(':');
          if (parts.length >= 2) {
            final targetId = parts[1];
            final nickname = parts.length > 2 ? parts.sublist(2).join(':') : '';
            ref.read(nicknamesProvider(conversationId).notifier).setNickname(targetId, nickname);
          }
        } else if (content.startsWith('system.theme.changed:')) {
          final parts = content.split(':');
          final url = parts.length > 1 ? parts.sublist(1).join(':') : '';
          ref.read(chatWallpaperProvider(conversationId).notifier).setWallpaper(url);
        } else if (content.startsWith('system.quick_reaction.changed:')) {
          final parts = content.split(':');
          final emoji = parts.length > 1 ? parts[1] : '👍';
          ref.read(quickReactionProvider(conversationId).notifier).setQuickReaction(emoji);
        }
      }
    }

    return ChatState(
      messages: paged.content,
      hasMore: paged.hasNext,
      pinnedMessages: conv.pinnedMessages,
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

  /// Task 55 — fetch messages that arrived while we were offline and merge them
  /// into the current state without duplicates. Called on every STOMP reconnect.
  Future<void> _catchupMessages() async {
    final current = state.valueOrNull;
    if (current == null) return;
    final nonPending = current.messages.where((m) => !m.isPending).toList();
    if (nonPending.isEmpty) return;
    // Messages list is newest-first; nonPending.first is the most recent.
    final newestAt = nonPending.first.createdAt;
    try {
      final fresh = await ref
          .read(chatRepositoryProvider)
          .getMessagesSince(conversationId, newestAt);
      if (fresh.isEmpty) return;
      final c = state.valueOrNull;
      if (c == null) return;
      final existingIds = c.messages.map((m) => m.id).toSet();
      final newMessages =
          fresh.where((m) => !existingIds.contains(m.id)).toList();
      if (newMessages.isEmpty) return;

      for (final m in newMessages) {
        if (m.isSystem) {
          final content = m.content;
          if (content.startsWith('system.nickname.changed:')) {
            final parts = content.split(':');
            if (parts.length >= 2) {
              final targetId = parts[1];
              final nickname = parts.length > 2 ? parts.sublist(2).join(':') : '';
              ref.read(nicknamesProvider(conversationId).notifier).setNickname(targetId, nickname);
            }
          } else if (content.startsWith('system.theme.changed:')) {
            final parts = content.split(':');
            final url = parts.length > 1 ? parts.sublist(1).join(':') : '';
            ref.read(chatWallpaperProvider(conversationId).notifier).setWallpaper(url);
          } else if (content.startsWith('system.quick_reaction.changed:')) {
            final parts = content.split(':');
            final emoji = parts.length > 1 ? parts[1] : '👍';
            ref.read(quickReactionProvider(conversationId).notifier).setQuickReaction(emoji);
          }
        }
      }

      // fresh is oldest-first; reverse so newest is at index 0.
      state = AsyncData(c.copyWith(
        messages: [...newMessages.reversed, ...c.messages],
      ));
      _markLoadedAsRead(newMessages);
    } catch (_) {
      // Best-effort: failed catch-up is non-fatal; user can pull-to-refresh.
    }
  }

  void _onNewMessage(MessageModel message) {
    final current = state.valueOrNull;
    if (current == null) return;

    if (message.isSystem) {
      final content = message.content;
      if (content.startsWith('system.nickname.changed:')) {
        final parts = content.split(':');
        if (parts.length >= 2) {
          final targetId = parts[1];
          final nickname = parts.length > 2 ? parts.sublist(2).join(':') : '';
          ref.read(nicknamesProvider(conversationId).notifier).setNickname(targetId, nickname);
        }
      } else if (content.startsWith('system.theme.changed:')) {
        final parts = content.split(':');
        final url = parts.length > 1 ? parts.sublist(1).join(':') : '';
        ref.read(chatWallpaperProvider(conversationId).notifier).setWallpaper(url);
      } else if (content.startsWith('system.quick_reaction.changed:')) {
        final parts = content.split(':');
        final emoji = parts.length > 1 ? parts[1] : '👍';
        ref.read(quickReactionProvider(conversationId).notifier).setQuickReaction(emoji);
      }
    }

    // Replace finalized AI streaming placeholder with the real persisted message
    final aiStreamingIdx = message.isAiMessage
        ? current.messages.indexWhere(
            (m) => m.isAiMessage && !m.isStreaming && m.senderId == kAiBotUserId,
          )
        : -1;

    // Replace optimistic message if one matches by senderId + content
    final pendingIdx = current.messages.indexWhere(
      (m) =>
          m.isPending &&
          m.senderId == message.senderId &&
          m.content == message.content,
    );

    final List<MessageModel> updated;
    if (aiStreamingIdx != -1) {
      updated = List.from(current.messages)..[aiStreamingIdx] = message;
    } else if (pendingIdx != -1) {
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

  void _onPinnedMessage(PinnedMessageEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    // Build PinnedMessageModel list from the pinned IDs using loaded messages.
    final loadedById = {for (final m in current.messages) m.id: m};
    final pinned = event.pinnedMessageIds
        .map((id) => loadedById[id])
        .whereType<MessageModel>()
        .map((m) => PinnedMessageModel(
              id: m.id,
              senderId: m.senderId,
              content: m.content,
              createdAt: m.createdAt,
            ))
        .toList();
    state = AsyncData(current.copyWith(pinnedMessages: pinned));
  }

  void _onAiStreamEvent(Map<String, dynamic> event) {
    final type = event['type'] as String?;
    final current = state.valueOrNull;
    if (current == null || type == null) return;

    final idx = current.messages.indexWhere(
      (m) => m.isAiMessage && m.isStreaming && m.senderId == kAiBotUserId,
    );
    if (idx == -1) return;

    final updated = List<MessageModel>.from(current.messages);
    switch (type) {
      case 'AI_TOOL_CALL':
        final toolName = event['toolName'] as String? ?? '';
        if (toolName.isNotEmpty) {
          final current2 = current.messages[idx];
          final tools = List<String>.from(current2.activeTools)..add(toolName);
          updated[idx] = current2.copyWith(activeTools: tools);
        }
      case 'AI_STREAM_CHUNK':
        final chunk = event['chunk'] as String? ?? '';
        updated[idx] = current.messages[idx].copyWith(
          content: current.messages[idx].content + chunk,
          isThinking: false,
        );
      case 'AI_STREAM_DONE':
        final rawSources = event['sources'] as List?;
        final sources = rawSources
            ?.whereType<Map<String, dynamic>>()
            .map((s) => s['documentId'] as String? ?? '')
            .where((id) => id.isNotEmpty)
            .toList();
        final rawTrace = event['trace'] as Map<String, dynamic>?;
        final trace = rawTrace != null ? AiTrace.fromJson(rawTrace) : null;
        updated[idx] = current.messages[idx].copyWith(
          isStreaming: false,
          isThinking: false,
          sources: sources,
          trace: trace,
          activeTools: [],
        );
      case 'AI_STREAM_ERROR':
        updated[idx] = current.messages[idx].copyWith(
          content: kAiErrorSentinel,
          isStreaming: false,
          isThinking: false,
          activeTools: [],
        );
    }
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
    // Ignore taps while a toggle for this message is still in flight, so a
    // burst of double-taps cannot fire overlapping add/remove requests.
    if (_reactionInFlight.contains(messageId)) return;
    final matches = current.messages.where((m) => m.id == messageId);
    final msg = matches.isEmpty ? null : matches.first;
    final alreadySame = msg != null &&
        msg.reactions.any((r) => r.userId == uid && r.emoji == emoji);
    final repo = ref.read(chatRepositoryProvider);
    _reactionInFlight.add(messageId);
    try {
      if (alreadySame) {
        await repo.removeReaction(messageId);
      } else {
        await repo.addReaction(messageId, emoji);
      }
    } catch (_) {
      // Realtime REACTION_UPDATED broadcast keeps state authoritative.
    } finally {
      _reactionInFlight.remove(messageId);
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

  /// Pin a message in this conversation (Task 53).
  Future<void> pinMessage(MessageModel message) async {
    final current = state.valueOrNull;
    if (current == null) return;
    // Optimistic: prepend to pinned list
    final pinned = [
      PinnedMessageModel(
        id: message.id,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt,
      ),
      ...current.pinnedMessages.where((p) => p.id != message.id),
    ];
    state = AsyncData(current.copyWith(pinnedMessages: pinned));
    try {
      await ref.read(chatRepositoryProvider).pinMessage(message.id);
    } catch (_) {
      // Revert on failure
      final c = state.valueOrNull;
      if (c != null) {
        state = AsyncData(
            c.copyWith(pinnedMessages: current.pinnedMessages));
      }
    }
  }

  /// Unpin a message (Task 53).
  Future<void> unpinMessage(String messageId) async {
    final current = state.valueOrNull;
    if (current == null) return;
    final reverted = current.pinnedMessages;
    state = AsyncData(current.copyWith(
        pinnedMessages: current.pinnedMessages
            .where((p) => p.id != messageId)
            .toList()));
    try {
      await ref.read(chatRepositoryProvider).unpinMessage(messageId);
    } catch (_) {
      final c = state.valueOrNull;
      if (c != null) state = AsyncData(c.copyWith(pinnedMessages: reverted));
    }
  }

  /// Forward a message to another conversation (Task 53).
  Future<bool> forwardMessage(
      String messageId, String targetConversationId) async {
    try {
      await ref
          .read(chatRepositoryProvider)
          .forwardMessage(messageId, targetConversationId);
      return true;
    } catch (_) {
      return false;
    }
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

  static final _aiMentionRe = RegExp(r'@(AI|ponai)\b', caseSensitive: false);

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

    // If the message mentions @AI, also insert a thinking placeholder
    final hasAiMention = type == 'text' && _aiMentionRe.hasMatch(content);
    final aiPlaceholder = hasAiMention
        ? MessageModel(
            id: 'ai-pending-${DateTime.now().millisecondsSinceEpoch}',
            conversationId: conversationId,
            senderId: kAiBotUserId,
            content: '',
            type: 'ai',
            readBy: const [],
            createdAt: DateTime.now(),
            isStreaming: true,
            isThinking: true,
          )
        : null;

    // Adding the message also clears the reply composer.
    state = AsyncData(current.copyWith(
      messages: [
        if (aiPlaceholder != null) aiPlaceholder,
        optimistic,
        ...current.messages,
      ],
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
      } catch (e) {
        final c = state.valueOrNull;
        if (c != null) {
          state = AsyncData(c.copyWith(
            messages: c.messages.where((m) => m.id != optimistic.id).toList(),
          ));
        }
        if (e is DioException && e.response?.statusCode == 429) {
          // Use global snackbar key — avoids BuildContext-across-async-gap lint.
          showErrorSnackBar('Too many messages. Please slow down.');
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
