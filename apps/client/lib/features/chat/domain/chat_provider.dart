import 'dart:async';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../data/chat_repository.dart';
import '../data/stomp_service.dart';
import 'chat_state.dart';

part 'chat_provider.g.dart';

// ---------------------------------------------------------------------------
// ConversationsNotifier — conversation list + realtime notification updates
// ---------------------------------------------------------------------------

@riverpod
class ConversationsNotifier extends _$ConversationsNotifier {
  StreamSubscription<Map<String, dynamic>>? _notifSub;

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
    ref.onDispose(() => _notifSub?.cancel());

    return repo.listConversations();
  }

  void _onNotification(Map<String, dynamic> notif) {
    final current = state.valueOrNull;
    if (current == null) return;

    // Chat-service gửi flat payload: {type, conversationId, senderName}
    final type = notif['type'] as String?;
    if (type == 'NEW_MESSAGE') {
      final convId = notif['conversationId'] as String?;
      if (convId == null) return;

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

    ref.onDispose(() {
      _messageSub?.cancel();
      _typingSub?.cancel();
      _readSub?.cancel();
      _typingTimer?.cancel();
      for (final t in _typingTimers.values) {
        t.cancel();
      }
      _typingTimers.clear();
      stomp.unsubscribeConversation(conversationId);
    });

    // API returns DESC (newest first) — use directly with ListView(reverse: true)
    final paged =
        await ref.read(chatRepositoryProvider).getMessages(conversationId, 0, 20);
    return ChatState(
      messages: paged.content,
      hasMore: (paged.page + 1) * paged.size < paged.totalElements,
    );
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

    final nextPage = current.currentPage + 1;
    try {
      final paged = await ref.read(chatRepositoryProvider).getMessages(
            conversationId,
            nextPage,
            20,
          );
      final fresh = state.valueOrNull ?? current;
      state = AsyncData(fresh.copyWith(
        messages: [...fresh.messages, ...paged.content],
        hasMore: (paged.page + 1) * paged.size < paged.totalElements,
        currentPage: nextPage,
        isLoadingMore: false,
      ));
    } catch (_) {
      final fresh = state.valueOrNull ?? current;
      state = AsyncData(fresh.copyWith(isLoadingMore: false));
    }
  }

  Future<void> sendMessage(String content) async {
    final current = state.valueOrNull;
    if (current == null) return;

    final uid = _currentUserId;
    if (uid == null) return;

    final optimistic = MessageModel(
      id: 'pending_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: conversationId,
      senderId: uid,
      content: content,
      type: 'text',
      readBy: [uid],
      createdAt: DateTime.now(),
      isPending: true,
    );

    state = AsyncData(current.copyWith(
      messages: [optimistic, ...current.messages],
    ));

    final stomp = ref.read(stompServiceProvider.notifier);
    if (stomp.isConnected) {
      stomp.sendMessage(conversationId, content);
    } else {
      // REST fallback when STOMP unavailable
      try {
        final sent = await ref
            .read(chatRepositoryProvider)
            .sendMessageRest(conversationId, content);
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
