// Part of chat_provider.dart — the optimistic send path (STOMP with REST
// fallback), its watchdogs, server rejections and the typing signal. Split out
// for the clean-code file limit; these remain methods of ChatNotifier.
part of 'chat_provider.dart';

mixin _ChatSendMixin on _$ChatNotifier, _ChatActionsMixin {
  /// Provided by ChatNotifier.
  ChatAiStreamHandler get _ai;
  bool get _isDirectAiChat;

  /// Per-optimistic-message send watchdogs (keyed by the local `pending_…` id).
  /// A STOMP send has no ack; if no server echo arrives in [_sendTimeout] the
  /// bubble is marked failed so the user can retry instead of spinning forever.
  final Map<String, Timer> _sendWatchdogs = {};
  static const Duration _sendTimeout = Duration(seconds: 15);

  /// AI placeholder created alongside an optimistic send (pending id → AI
  /// placeholder id), so a rejected/failed send never leaves a "thinking"
  /// bubble behind.
  final Map<String, String> _aiPlaceholderFor = {};

  Timer? _typingTimer;

  static final _aiMentionRe = RegExp(r'@(AI|ponai)\b', caseSensitive: false);

  void _disposeTyping() => _typingTimer?.cancel();

  void _startSendWatchdog(String pendingId) {
    _sendWatchdogs[pendingId]?.cancel();
    _sendWatchdogs[pendingId] = Timer(_sendTimeout, () {
      _sendWatchdogs.remove(pendingId);
      _failPending(pendingId);
    });
  }

  void _cancelSendWatchdogs() {
    for (final t in _sendWatchdogs.values) {
      t.cancel();
    }
    _sendWatchdogs.clear();
  }

  /// Marks the optimistic message [pendingId] as failed (tap-to-retry) and
  /// drops its AI placeholder. No-op once it was reconciled with the server.
  void _failPending(String pendingId) {
    _sendWatchdogs.remove(pendingId)?.cancel();
    final current = state.valueOrNull;
    if (current == null) return;
    final aiId = _aiPlaceholderFor.remove(pendingId);
    var messages = current.messages;
    if (aiId != null) {
      _ai.cancelPending(aiId);
      messages = messages.where((m) => m.id != aiId).toList();
    }
    final idx = messages.indexWhere((m) => m.id == pendingId && m.isPending);
    if (idx != -1) {
      messages = List<MessageModel>.from(messages)
        ..[idx] = messages[idx].copyWith(isPending: false, sendFailed: true);
    }
    if (!identical(messages, current.messages)) {
      state = AsyncData(current.copyWith(messages: messages));
    }
  }

  /// `MESSAGE_REJECTED` on the user queue: the server refused the oldest
  /// in-flight STOMP send of this conversation. Fail it now (instead of after
  /// the 15 s watchdog) and say why.
  void _onMessageRejected(String? code) {
    final current = state.valueOrNull;
    if (current == null) return;
    // Oldest pending = last in the newest-first list.
    final pending = current.messages.lastWhereOrNull(
      (m) => m.isPending && m.id.startsWith('pending_'),
    );
    if (pending != null) _failPending(pending.id);
    _showError(code == null ? null : chatCodeMessage(_l10n, code));
  }

  /// Retry a message whose optimistic send failed: drop the failed bubble and
  /// re-send its content to the SAME reply target.
  Future<void> retrySend(String messageId) async {
    final current = state.valueOrNull;
    if (current == null) return;
    final msg = current.messages.firstWhereOrNull((m) => m.id == messageId);
    if (msg == null || !msg.sendFailed) return;
    _sendWatchdogs.remove(messageId)?.cancel();
    state = AsyncData(current.copyWith(
      messages: current.messages.where((m) => m.id != messageId).toList(),
    ));
    await sendMessage(
      msg.content,
      type: msg.type,
      replyTo: msg.replyPreview,
    );
  }

  @override
  Future<void> sendMessage(
    String content, {
    String type = 'text',
    ReplyPreview? replyTo,
  }) async {
    final current = state.valueOrNull;
    if (current == null) return;
    final uid = _currentUserId;
    if (uid == null) return;

    // An explicit target (retry) wins over the composer's reply state.
    final replying = current.replyingTo;
    final replyPreview = replyTo ??
        (replying == null
            ? null
            : ReplyPreview(
                messageId: replying.id,
                senderId: replying.senderId,
                content: replying.content,
              ));
    final replyToId = replyPreview?.messageId;

    final now = DateTime.now();
    final optimistic = MessageModel(
      id: 'pending_${now.microsecondsSinceEpoch}',
      conversationId: conversationId,
      senderId: uid,
      content: content,
      type: type,
      readBy: [uid],
      createdAt: now,
      replyToId: replyToId,
      replyPreview: replyPreview,
      isPending: true,
    );
    // @AI mention, or any text in a 1-1 AI chat → a thinking placeholder so
    // the reply streams in (and errors surface) right under the message.
    final expectsAi =
        type == 'text' && (_isDirectAiChat || _aiMentionRe.hasMatch(content));
    final aiPlaceholderId = 'ai-pending-${now.microsecondsSinceEpoch}';
    if (expectsAi) {
      _ai.beginPending(aiPlaceholderId);
      _aiPlaceholderFor[optimistic.id] = aiPlaceholderId;
    }

    state = AsyncData(current.copyWith(
      messages: [
        if (expectsAi)
          MessageModel(
            id: aiPlaceholderId,
            conversationId: conversationId,
            senderId: kAiBotUserId,
            content: '',
            type: 'ai',
            readBy: const [],
            createdAt: now,
            isStreaming: true,
            isThinking: true,
          ),
        optimistic,
        ...current.messages,
      ],
      clearReplyingTo:
          true, // adding the message also clears the reply composer
    ));

    final stomp = ref.read(stompServiceProvider.notifier);
    if (stomp.isConnected) {
      stomp.sendMessage(conversationId, content,
          type: type, replyToId: replyToId);
      // STOMP send has no ack; watchdog fails the bubble (tap-to-retry) on no echo.
      _startSendWatchdog(optimistic.id);
      return;
    }
    try {
      // REST fallback when STOMP is unavailable.
      final sent = await ref.read(chatRepositoryProvider).sendMessageRest(
          conversationId, content,
          type: type, replyToId: replyToId);
      _aiPlaceholderFor.remove(optimistic.id);
      final c = state.valueOrNull;
      if (c != null) {
        // The STOMP echo may already have reconciled it — never show twice.
        final alreadyThere = c.messages.any((m) => m.id == sent.id);
        state = AsyncData(c.copyWith(
          messages: alreadyThere
              ? c.messages.where((m) => m.id != optimistic.id).toList()
              : c.messages
                  .map((m) => m.id == optimistic.id ? sent : m)
                  .toList(),
        ));
      }
    } catch (e) {
      // Keep the bubble (tap-to-retry) instead of silently losing the text,
      // and say why it failed.
      _failPending(optimistic.id);
      _showError(chatErrorMessage(_l10n, e));
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
