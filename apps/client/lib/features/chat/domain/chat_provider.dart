import 'dart:async';
import 'package:collection/collection.dart';
import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../../core/utils/app_error.dart';
import '../../../core/utils/global_messenger.dart';
import '../../../l10n/app_localizations.dart';
import '../data/ai_persona_repository.dart';
import '../data/chat_repository.dart';
import '../data/stomp_service.dart';
import '../utils/chat_error.dart';
import 'chat_ai_stream_handler.dart';
import 'chat_state.dart';
import 'chat_stomp_reducers.dart';
import 'chat_system_message_parser.dart';

// Lightweight providers + per-conversation customization notifiers were split
// into chat_misc_providers.dart. Re-exported so existing importers of
// chat_provider.dart (userProfileProvider, nicknamesProvider, …) are unaffected.
export 'chat_misc_providers.dart';
// ConversationsNotifier was split into its own file; re-exported so importers
// of chat_provider.dart keep seeing conversationsNotifierProvider.
export 'conversations_notifier.dart';

part 'chat_provider.g.dart';
// Message action methods (reply/edit/reaction/recall/pin/unpin/forward/delete)
// and the send path live in mixins in separate part files for the clean-code
// file limit. They remain methods of ChatNotifier, so the public provider API
// is unchanged.
part 'chat_provider_actions.dart';
part 'chat_provider_send.dart';

/// Catch-up pages fetched after a reconnect before giving up (50 per page).
const _kMaxCatchupPages = 20;

// ---------------------------------------------------------------------------
// ChatNotifier — messages for a single conversation
// ---------------------------------------------------------------------------

@riverpod
class ChatNotifier extends _$ChatNotifier
    with _ChatActionsMixin, _ChatSendMixin {
  final Map<String, Timer> _typingTimers = {};
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  bool _catchupRunning = false;

  /// 1-1 conversation with the built-in AI: every text message gets a
  /// streaming placeholder (no `@AI` needed there).
  bool _directAi = false;

  @override
  bool get _isDirectAiChat => _directAi;

  /// AI streaming correlation (by `replyId`) + the per-reply watchdogs.
  @override
  late final ChatAiStreamHandler _ai = ChatAiStreamHandler(
    readState: () => state.valueOrNull,
    writeMessages: (messages) {
      final current = state.valueOrNull;
      if (current == null) return;
      state = AsyncData(current.copyWith(messages: messages));
    },
    currentUserId: () => _currentUserId,
    conversationId: conversationId,
  );

  @override
  Future<ChatState> build(String conversationId) async {
    final stomp = ref.read(stompServiceProvider.notifier);

    stomp.subscribeConversation(conversationId);

    bool mine(dynamic e) => e.conversationId == conversationId;
    _subscriptions.addAll([
      stomp.messages.where(mine).listen(_onNewMessage),
      stomp.typing.where(mine).listen(_onTypingEvent),
      stomp.readReceipts.where(mine).listen(_onReadReceipt),
      stomp.reactionUpdates.where(mine).listen(_onReactionUpdate),
      stomp.recalledMessages.where(mine).listen(_onRecall),
      stomp.editedMessages.where(mine).listen(_onEdit),
      stomp.pinnedMessageUpdates.where(mine).listen(_onPinnedMessage),
      stomp.reconnects.listen((_) => _catchupMessages()),
      stomp.aiStreamEvents
          .where((e) => e['conversationId'] == conversationId)
          .listen(_ai.onStreamEvent),
      stomp.notifications
          .where((n) =>
              n['type'] == 'MESSAGE_REJECTED' &&
              n['conversationId'] == conversationId)
          .listen((n) => _onMessageRejected(n['code'] as String?)),
    ]);

    ref.onDispose(() {
      for (final s in _subscriptions) {
        s.cancel();
      }
      _subscriptions.clear();
      _ai.dispose();
      _cancelSendWatchdogs();
      _disposeTyping();
      for (final t in _typingTimers.values) {
        t.cancel();
      }
      _typingTimers.clear();
      stomp.unsubscribeConversation(conversationId);
    });

    final repo = ref.read(chatRepositoryProvider);
    final personaRepo = ref.read(aiPersonaRepositoryProvider);
    // Fetch messages, conversation and persona in parallel for initial load.
    final results = await Future.wait([
      repo.getMessages(conversationId, size: 20),
      repo.getConversation(conversationId),
      // Persona is optional config — a failure degrades gracefully to the
      // default persona, but we log it rather than swallowing it silently.
      personaRepo.getPersona(conversationId).then<dynamic>((v) => v).catchError((Object e) {
        debugPrint('Persona fetch failed for $conversationId: $e');
        return null;
      }),
    ]);
    final paged = results[0] as PagedResult<MessageModel>;
    final conv = results[1] as ConversationModel;
    final persona = results[2];
    _directAi = conv.isDirectAi;
    _markLoadedAsRead(paged.content);

    // Parse historical system messages for config (theme, nickname, quick reaction)
    for (final m in paged.content.reversed) {
      ChatSystemMessageParser.apply(ref, conversationId, m);
    }

    return ChatState(
      messages: paged.content,
      hasMore: paged.hasNext,
      pinnedMessages: conv.pinnedMessages,
      aiPersonaName: (persona?.name as String?) ?? 'PON AI',
      aiPersonaAvatarUrl: persona?.avatarUrl as String?,
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

  /// Task 55 — fetch the messages that arrived while the socket was down and
  /// merge them in without duplicates. Called on every STOMP reconnect. The
  /// server pages 50 at a time (oldest first) with an exact `hasNext`, so
  /// keep paging from the last item until the gap is closed.
  Future<void> _catchupMessages() async {
    if (_catchupRunning) return;
    final start = state.valueOrNull;
    if (start == null) return;
    final newest = ChatStompReducers.newestConfirmed(start.messages);
    if (newest == null) return;
    _catchupRunning = true;
    var after = newest.createdAt;
    String? afterId = newest.id;
    try {
      for (var page = 0; page < _kMaxCatchupPages; page++) {
        final fresh = await ref
            .read(chatRepositoryProvider)
            .getMessagesSince(conversationId, after, afterId: afterId);
        final c = state.valueOrNull;
        if (c == null) return;
        if (fresh.content.isNotEmpty) {
          for (final m in fresh.content) {
            ChatSystemMessageParser.apply(ref, conversationId, m);
          }
          state = AsyncData(c.copyWith(
            messages: ChatStompReducers.mergeCatchup(c.messages, fresh.content),
          ));
          _markLoadedAsRead(fresh.content);
          after = fresh.content.last.createdAt;
          afterId = fresh.content.last.id;
        }
        if (!fresh.hasNext || fresh.content.isEmpty) break;
      }
    } catch (_) {
      // Best-effort: a failed catch-up is non-fatal; the next reconnect or
      // re-opening the chat recovers.
    } finally {
      _catchupRunning = false;
    }
  }

  void _onNewMessage(MessageModel message) {
    final current = state.valueOrNull;
    if (current == null) return;

    ChatSystemMessageParser.apply(ref, conversationId, message);

    final messages = _ai.reconcilePersisted(current.messages, message) ??
        ChatStompReducers.reconcileNewMessage(current.messages, message);
    // Optimistic sends reconciled by this message need no watchdog anymore.
    _sendWatchdogs.removeWhere((pendingId, timer) {
      final gone = !messages.any((m) => m.id == pendingId);
      if (gone) timer.cancel();
      return gone;
    });
    _aiPlaceholderFor
        .removeWhere((pendingId, _) => !messages.any((m) => m.id == pendingId));
    state = AsyncData(current.copyWith(messages: messages));

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
    state = AsyncData(current.copyWith(
        messages: ChatStompReducers.applyReadReceipt(current.messages, event)));
  }

  void _onReactionUpdate(ReactionUpdateEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(
        messages:
            ChatStompReducers.applyReactionUpdate(current.messages, event)));
  }

  void _onRecall(RecallEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(
      messages: ChatStompReducers.applyRecall(current.messages, event),
      // A recalled message cannot stay pinned / quoted in the header.
      pinnedMessages:
          current.pinnedMessages.where((p) => p.id != event.messageId).toList(),
    ));
  }

  void _onEdit(MessageUpdateEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(
        messages: ChatStompReducers.applyEdit(current.messages, event)));
  }

  void _onPinnedMessage(PinnedMessageEvent event) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(
        pinnedMessages: ChatStompReducers.buildPinned(
            current.messages, event,
            previous: current.pinnedMessages)));
  }

  void _onTypingEvent(TypingEvent event) {
    // The server echoes our own typing back on the topic; it must never hide
    // (or stand in for) somebody else's indicator.
    if (event.userId == _currentUserId) return;
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
}
