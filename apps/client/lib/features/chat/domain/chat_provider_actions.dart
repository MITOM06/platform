// Part of chat_provider.dart — message action methods extracted into a mixin
// for the clean-code file limit. These remain methods of ChatNotifier (the
// mixin is applied with `with _ChatActionsMixin`), so the public provider API
// is byte-for-byte unchanged. Shared private helpers used by both the core
// notifier and these actions (`_reactionInFlight`, `_currentUserId`,
// `loadMore`) live here too, accessible from the notifier via the mixin.
part of 'chat_provider.dart';

mixin _ChatActionsMixin on _$ChatNotifier {
  /// Provided by the send mixin (applied to the same ChatNotifier). Declared
  /// here so actions can use the optimistic-send path.
  Future<void> sendMessage(String content, {String type = 'text'});

  /// Most messages a conversation can pin (chat-service MAX_PINNED_MESSAGES).
  static const int maxPinnedMessages = 5;

  /// Message ids with a reaction request in flight. Guards against rapid
  /// repeated double-taps spamming the server with add/remove churn before the
  /// authoritative REACTION_UPDATED broadcast lands.
  final Set<String> _reactionInFlight = {};

  /// Localized strings without a widget context (resolved via the router).
  AppLocalizations get _l10n => appL10n();

  /// Shows [message] (or the generic "action failed") as an error snackbar.
  void _showError(String? message) =>
      showErrorSnackBar(message ?? _l10n.errActionFailed);

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
    } catch (e) {
      // The REACTION_UPDATED broadcast keeps state authoritative, but surface
      // the failure (incl. the 429 reaction rate limit) so the user knows the
      // tap didn't take effect.
      _showActionError(e);
    } finally {
      _reactionInFlight.remove(messageId);
    }
  }

  Future<void> recallMessage(String messageId) async {
    final current = state.valueOrNull;
    try {
      await ref.read(chatRepositoryProvider).recallMessage(messageId);
    } catch (e) {
      // Re-assert the pre-recall state (no local change was applied yet, but
      // guard against any in-flight optimistic edit) and tell the user.
      if (current != null && state.hasValue) state = AsyncData(current);
      _showActionError(e);
    }
  }

  /// Surface the localized message for a failed chat-service call.
  void _showActionError([Object? error]) => _showError(
      error == null ? null : chatErrorMessage(_l10n, error));

  /// Edit a sent message. Optimistically updates locally; the server's
  /// MESSAGE_UPDATED broadcast keeps both peers authoritative.
  Future<void> editMessage(String messageId, String content) async {
    final trimmed = content.trim();
    if (trimmed.isEmpty) return;
    final current = state.valueOrNull;
    // Only text can be edited (chat-service MessageTypePolicy): editing a
    // voice/sticker/media message would overwrite its payload with text.
    final target = current?.messages.firstWhereOrNull((m) => m.id == messageId);
    if (target == null || target.type != 'text' || target.recalled) {
      if (current != null) {
        state = AsyncData(current.copyWith(clearEditingMessage: true));
      }
      return;
    }
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
    } catch (e) {
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
      _showActionError(e);
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

  /// Pin a message in this conversation (Task 53). At most
  /// [maxPinnedMessages] — a full set is refused here and by the server
  /// (409 `PIN_LIMIT_REACHED`); nothing is ever evicted silently. Returns
  /// whether the pin was applied.
  Future<bool> pinMessage(MessageModel message) async {
    final current = state.valueOrNull;
    if (current == null) return false;
    if (current.pinnedMessages.any((p) => p.id == message.id)) return true;
    if (current.pinnedMessages.length >= maxPinnedMessages) {
      _showError(_l10n.pinLimitReached);
      return false;
    }
    final pinned = [
      PinnedMessageModel(
        id: message.id,
        senderId: message.senderId,
        content: message.content,
        // Carry type so the optimistic preview is sanitized like the rest.
        type: message.type,
        createdAt: message.createdAt,
      ),
      ...current.pinnedMessages,
    ];
    state = AsyncData(current.copyWith(pinnedMessages: pinned));
    try {
      await ref.read(chatRepositoryProvider).pinMessage(message.id);
      return true;
    } catch (e) {
      final c = state.valueOrNull;
      if (c != null) {
        state = AsyncData(c.copyWith(
            pinnedMessages:
                c.pinnedMessages.where((p) => p.id != message.id).toList()));
      }
      // 409 PIN_LIMIT_REACHED / 403 GROUP_ADMIN_REQUIRED → specific text.
      _showActionError(e);
      return false;
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
    } catch (e) {
      final c = state.valueOrNull;
      if (c != null) state = AsyncData(c.copyWith(pinnedMessages: reverted));
      _showActionError(e);
    }
  }

  /// Forward a message to another conversation (Task 53). Returns null on
  /// success, else the localized reason (blocked, type not forwardable,
  /// rate limit, …).
  Future<String?> forwardMessage(
      String messageId, String targetConversationId) async {
    try {
      await ref
          .read(chatRepositoryProvider)
          .forwardMessage(messageId, targetConversationId);
      return null;
    } catch (e) {
      return chatErrorMessage(_l10n, e);
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
    } catch (e) {
      // Restore the message we optimistically removed and tell the user.
      if (state.hasValue) state = AsyncData(current);
      _showActionError(e);
    }
  }
}
