import 'dart:async';
import 'package:collection/collection.dart';
import 'package:dio/dio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../../core/l10n/l10n_ext.dart';
import '../../../core/router/app_router.dart';
import '../../../core/utils/global_messenger.dart';
import '../data/ai_persona_repository.dart';
import '../data/chat_repository.dart';
import '../data/stomp_service.dart';
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
// live in a mixin in a separate part file for the clean-code file limit. They
// remain methods of ChatNotifier, so the public provider API is unchanged.
part 'chat_provider_actions.dart';

// ---------------------------------------------------------------------------
// ChatNotifier — messages for a single conversation
// ---------------------------------------------------------------------------

@riverpod
class ChatNotifier extends _$ChatNotifier with _ChatActionsMixin {
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

  /// AI streaming placeholder correlation + chunk/done/error handling + the
  /// response watchdog timer (extracted for the clean-code file limit).
  late final ChatAiStreamHandler _ai = ChatAiStreamHandler(
    readState: () => state.valueOrNull,
    writeMessages: (messages) {
      final current = state.valueOrNull;
      if (current == null) return;
      state = AsyncData(current.copyWith(messages: messages));
    },
  );

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

    _aiStreamSub = stomp.aiStreamEvents.listen(_ai.onStreamEvent);

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
      _ai.dispose();
      _typingTimer?.cancel();
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
      personaRepo.getPersona(conversationId).then<dynamic>((v) => v).catchError((_) => null),
    ]);
    final paged = results[0] as PagedResult<MessageModel>;
    final conv = results[1] as ConversationModel;
    final persona = results[2];
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
        ChatSystemMessageParser.apply(ref, conversationId, m);
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

    ChatSystemMessageParser.apply(ref, conversationId, message);

    final reconciled = ChatStompReducers.reconcileNewMessage(
      current.messages,
      message,
      finalizedAiPlaceholderId: _ai.finalizedAiPlaceholderId,
    );
    if (reconciled.consumedAiPlaceholder) {
      _ai.finalizedAiPlaceholderId = null;
    }

    state = AsyncData(current.copyWith(messages: reconciled.messages));

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
        messages: ChatStompReducers.applyRecall(current.messages, event)));
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
        pinnedMessages:
            ChatStompReducers.buildPinned(current.messages, event)));
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
    final aiPlaceholderId = 'ai-pending-${DateTime.now().millisecondsSinceEpoch}';
    final aiPlaceholder = hasAiMention
        ? MessageModel(
            id: aiPlaceholderId,
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
    if (hasAiMention) {
      _ai.beginPending(aiPlaceholderId);
    }

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
}
