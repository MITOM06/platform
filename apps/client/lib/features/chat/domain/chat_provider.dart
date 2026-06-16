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
import 'chat_misc_providers.dart';
import 'chat_state.dart';

// Lightweight providers + per-conversation customization notifiers were split
// into chat_misc_providers.dart. Re-exported so existing importers of
// chat_provider.dart (userProfileProvider, nicknamesProvider, …) are unaffected.
export 'chat_misc_providers.dart';
// ConversationsNotifier was split into its own file; re-exported so importers
// of chat_provider.dart keep seeing conversationsNotifierProvider.
export 'conversations_notifier.dart';

part 'chat_provider.g.dart';

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

  /// The local id of the AI streaming placeholder currently awaiting a
  /// response, or null when no AI request is pending. Tracked explicitly (as a
  /// correlation id) so stream chunks and the final persisted message target
  /// the exact placeholder rather than guessing via the fragile
  /// `isStreaming`/senderId+content heuristics.
  String? _aiPlaceholderId;

  /// Fires if the AI sends no chunk within the window, so a stuck placeholder
  /// can't spin forever (e.g. ai-service down / Redis hiccup).
  Timer? _aiTimeoutTimer;
  static const Duration _aiResponseTimeout = Duration(seconds: 30);

  /// Id of the AI placeholder that has finished streaming (AI_STREAM_DONE) and
  /// is awaiting its real persisted message via _onNewMessage. Lets us replace
  /// the exact placeholder instead of guessing the wrong AI message.
  String? _finalizedAiPlaceholderId;

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
      _aiTimeoutTimer?.cancel();
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

    // Replace the finalized AI streaming placeholder with the real persisted
    // message. Prefer the exact tracked id (set on AI_STREAM_DONE); only fall
    // back to a heuristic when no id is tracked.
    int aiStreamingIdx = -1;
    if (message.isAiMessage) {
      if (_finalizedAiPlaceholderId != null) {
        aiStreamingIdx = current.messages
            .indexWhere((m) => m.id == _finalizedAiPlaceholderId);
      }
      if (aiStreamingIdx == -1) {
        aiStreamingIdx = current.messages.indexWhere(
          (m) =>
              m.isAiMessage &&
              !m.isStreaming &&
              m.senderId == kAiBotUserId &&
              m.id.startsWith('ai-pending-'),
        );
      }
    }

    // Replace the optimistic (locally-echoed) message if one matches by id-shape
    // + sender + content. Restrict to pending placeholders we created so we
    // never clobber a distinct real message that happens to share text.
    final pendingIdx = current.messages.indexWhere(
      (m) =>
          m.isPending &&
          m.id.startsWith('pending_') &&
          m.senderId == message.senderId &&
          m.content == message.content,
    );

    final List<MessageModel> updated;
    if (aiStreamingIdx != -1) {
      updated = List.from(current.messages)..[aiStreamingIdx] = message;
      _finalizedAiPlaceholderId = null;
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

  /// (Re)arm the AI response watchdog. If no chunk/done/error arrives in time
  /// the streaming placeholder is replaced with an error sentinel so it can't
  /// spin indefinitely.
  void _startAiTimeout() {
    _aiTimeoutTimer?.cancel();
    _aiTimeoutTimer = Timer(_aiResponseTimeout, _onAiTimeout);
  }

  void _clearAiTimeout() {
    _aiTimeoutTimer?.cancel();
    _aiTimeoutTimer = null;
  }

  void _onAiTimeout() {
    final placeholderId = _aiPlaceholderId;
    final current = state.valueOrNull;
    if (placeholderId == null || current == null) {
      _aiPlaceholderId = null;
      return;
    }
    final idx = current.messages.indexWhere((m) => m.id == placeholderId);
    if (idx != -1) {
      final updated = List<MessageModel>.from(current.messages);
      updated[idx] = current.messages[idx].copyWith(
        content: kAiErrorSentinel,
        isStreaming: false,
        isThinking: false,
        activeTools: [],
      );
      state = AsyncData(current.copyWith(messages: updated));
    }
    _aiPlaceholderId = null;
  }

  void _onAiStreamEvent(Map<String, dynamic> event) {
    final type = event['type'] as String?;
    final current = state.valueOrNull;
    if (current == null || type == null) return;

    // Target the tracked placeholder by id (correlation), falling back to the
    // legacy streaming-flag heuristic for placeholders created before tracking.
    final placeholderId = _aiPlaceholderId;
    int idx = placeholderId != null
        ? current.messages.indexWhere((m) => m.id == placeholderId)
        : -1;
    if (idx == -1) {
      idx = current.messages.indexWhere(
        (m) => m.isAiMessage && m.isStreaming && m.senderId == kAiBotUserId,
      );
    }
    if (idx == -1) return;

    // A live event means the AI is responding — push the watchdog out (chunks)
    // or disarm it entirely (terminal events).
    if (type == 'AI_STREAM_CHUNK' || type == 'AI_TOOL_CALL') {
      _startAiTimeout();
    } else if (type == 'AI_STREAM_DONE' || type == 'AI_STREAM_ERROR') {
      _clearAiTimeout();
      // Remember which placeholder finished so _onNewMessage swaps the exact
      // one for the persisted message (DONE only — an errored bubble stays).
      if (type == 'AI_STREAM_DONE') {
        _finalizedAiPlaceholderId = current.messages[idx].id;
      }
      _aiPlaceholderId = null;
    }

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
        final errorMsg = event['error'] as String? ?? '';
        final isQuota = errorMsg.toLowerCase().contains('quota');
        updated[idx] = current.messages[idx].copyWith(
          content: isQuota ? kAiQuotaExceededSentinel : kAiErrorSentinel,
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
      // The REACTION_UPDATED broadcast keeps state authoritative, but surface
      // the failure so the user knows the tap didn't take effect.
      _showActionError();
    } finally {
      _reactionInFlight.remove(messageId);
    }
  }

  Future<void> recallMessage(String messageId) async {
    final current = state.valueOrNull;
    try {
      await ref.read(chatRepositoryProvider).recallMessage(messageId);
    } catch (_) {
      // Re-assert the pre-recall state (no local change was applied yet, but
      // guard against any in-flight optimistic edit) and tell the user.
      if (current != null && state.hasValue) state = AsyncData(current);
      _showActionError();
    }
  }

  /// Surface a generic "action failed" SnackBar via the app-wide messenger.
  void _showActionError() {
    final context =
        ref.read(appRouterProvider).routerDelegate.navigatorKey.currentContext;
    if (context == null) return;
    showErrorSnackBar(context.l10n.errActionFailed);
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
      // Roll back the optimistic edit and tell the user it didn't save.
      if (current != null && state.hasValue) {
        state = AsyncData(state.requireValue.copyWith(
          messages: state.requireValue.messages
              .map((m) {
                if (m.id != messageId) return m;
                final orig = current.messages.firstWhereOrNull((o) => o.id == messageId);
                return orig ?? m;
              })
              .toList(),
        ));
      }
      _showActionError();
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
    } catch (_) {
      // Restore the message we optimistically removed and tell the user.
      if (state.hasValue) state = AsyncData(current);
      _showActionError();
    }
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
      _aiPlaceholderId = aiPlaceholderId;
      _startAiTimeout();
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

  String? get _currentUserId {
    final auth = ref.read(authNotifierProvider).valueOrNull;
    return auth is AuthAuthenticated ? auth.user.id : null;
  }
}
