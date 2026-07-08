// Part of chat_provider.dart — message action methods extracted into a mixin
// for the clean-code file limit. These remain methods of ChatNotifier (the
// mixin is applied with `with _ChatActionsMixin`), so the public provider API
// is byte-for-byte unchanged. Shared private helpers used by both the core
// notifier and these actions (`_reactionInFlight`, `_currentUserId`,
// `loadMore`) live here too, accessible from the notifier via the mixin.
part of 'chat_provider.dart';

mixin _ChatActionsMixin on _$ChatNotifier {
  /// Provided by ChatNotifier (the class this mixin is applied to). Declared
  /// here so mixin methods (e.g. [retrySend]) can invoke the optimistic-send
  /// path without duplicating it.
  Future<void> sendMessage(String content, {String type = 'text'});

  /// Message ids with a reaction request in flight. Guards against rapid
  /// repeated double-taps spamming the server with add/remove churn before the
  /// authoritative REACTION_UPDATED broadcast lands.
  final Set<String> _reactionInFlight = {};

  /// Per-optimistic-message send watchdogs (keyed by the local `pending_…` id).
  /// A STOMP send has no ack; if no server echo arrives in [_sendTimeout] the
  /// bubble is marked failed so the user can retry instead of spinning forever.
  final Map<String, Timer> _sendWatchdogs = {};
  static const Duration _sendTimeout = Duration(seconds: 15);

  /// Arms the send watchdog for the optimistic message [pendingId].
  void _startSendWatchdog(String pendingId) {
    _sendWatchdogs[pendingId]?.cancel();
    _sendWatchdogs[pendingId] = Timer(_sendTimeout, () {
      _sendWatchdogs.remove(pendingId);
      final current = state.valueOrNull;
      if (current == null) return;
      // If the message is gone (reconciled with the server echo) or already
      // resolved, this is a no-op — mirrors the AI placeholder watchdog.
      final idx = current.messages.indexWhere(
        (m) => m.id == pendingId && m.isPending,
      );
      if (idx == -1) return;
      final updated = List<MessageModel>.from(current.messages);
      updated[idx] =
          current.messages[idx].copyWith(isPending: false, sendFailed: true);
      state = AsyncData(current.copyWith(messages: updated));
    });
  }

  void _cancelSendWatchdogs() {
    for (final t in _sendWatchdogs.values) {
      t.cancel();
    }
    _sendWatchdogs.clear();
  }

  /// Retry a message whose optimistic send failed: drop the failed placeholder
  /// and re-send its content (reuses the normal optimistic send path).
  Future<void> retrySend(String messageId) async {
    final current = state.valueOrNull;
    if (current == null) return;
    final msg = current.messages.firstWhereOrNull((m) => m.id == messageId);
    if (msg == null || !msg.sendFailed) return;
    _sendWatchdogs.remove(messageId)?.cancel();
    state = AsyncData(current.copyWith(
      messages: current.messages.where((m) => m.id != messageId).toList(),
    ));
    await sendMessage(msg.content, type: msg.type);
  }

  String? get _currentUserId {
    final auth = ref.read(authNotifierProvider).valueOrNull;
    return auth is AuthAuthenticated ? auth.user.id : null;
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

  /// Surface the localized rate-limit (429) message. Resolves a context via the
  /// router to avoid the BuildContext-across-async-gap lint.
  void _showRateLimitError() {
    final context =
        ref.read(appRouterProvider).routerDelegate.navigatorKey.currentContext;
    showErrorSnackBar(context != null
        ? context.l10n.rateLimitError
        : 'Too many messages. Please slow down.');
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
        // Carry type so the optimistic preview is sanitized like the rest.
        type: message.type,
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
}
