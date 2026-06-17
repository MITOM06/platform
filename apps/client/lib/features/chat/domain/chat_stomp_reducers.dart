import 'chat_events.dart';
import 'chat_models.dart';

/// Result of [ChatStompReducers.reconcileNewMessage].
class ReconcileResult {
  final List<MessageModel> messages;
  final bool consumedAiPlaceholder;
  const ReconcileResult({
    required this.messages,
    required this.consumedAiPlaceholder,
  });
}

/// Pure list transforms for the simple realtime STOMP events (read receipt,
/// reaction update, recall, edit, pinned). Extracted from ChatNotifier for the
/// clean-code file limit; each function returns a new list and never mutates
/// its input, so the notifier stays the sole owner of `state`.
class ChatStompReducers {
  const ChatStompReducers._();

  /// Append [event.readerId] to the read receipts of the matching message.
  static List<MessageModel> applyReadReceipt(
    List<MessageModel> messages,
    ReadReceiptEvent event,
  ) {
    return messages.map((m) {
      if (m.id == event.messageId && !m.readBy.contains(event.readerId)) {
        return m.copyWith(readBy: [...m.readBy, event.readerId]);
      }
      return m;
    }).toList();
  }

  /// Replace the reactions of the matching message with the authoritative set.
  static List<MessageModel> applyReactionUpdate(
    List<MessageModel> messages,
    ReactionUpdateEvent event,
  ) {
    return messages
        .map((m) =>
            m.id == event.messageId ? m.copyWith(reactions: event.reactions) : m)
        .toList();
  }

  /// Mark the matching message as recalled (clearing content + reactions).
  static List<MessageModel> applyRecall(
    List<MessageModel> messages,
    RecallEvent event,
  ) {
    return messages
        .map((m) => m.id == event.messageId
            ? m.copyWith(recalled: true, content: '', reactions: const [])
            : m)
        .toList();
  }

  /// Apply an edited content + editedAt to the matching message.
  static List<MessageModel> applyEdit(
    List<MessageModel> messages,
    MessageUpdateEvent event,
  ) {
    return messages
        .map((m) => m.id == event.messageId
            ? m.copyWith(content: event.content, editedAt: event.editedAt)
            : m)
        .toList();
  }

  /// Reconcile an incoming persisted [message] against the current list:
  /// replace the finalized AI streaming placeholder, else a matching optimistic
  /// (locally-echoed) pending message, else prepend as new.
  ///
  /// [finalizedAiPlaceholderId] is the id remembered on AI_STREAM_DONE.
  /// `consumedAiPlaceholder` in the result is true when that exact placeholder
  /// was swapped, so the caller can clear the tracked id.
  static ReconcileResult reconcileNewMessage(
    List<MessageModel> messages,
    MessageModel message, {
    required String? finalizedAiPlaceholderId,
  }) {
    // Replace the finalized AI streaming placeholder with the real persisted
    // message. Prefer the exact tracked id (set on AI_STREAM_DONE); only fall
    // back to a heuristic when no id is tracked.
    int aiStreamingIdx = -1;
    if (message.isAiMessage) {
      if (finalizedAiPlaceholderId != null) {
        aiStreamingIdx =
            messages.indexWhere((m) => m.id == finalizedAiPlaceholderId);
      }
      if (aiStreamingIdx == -1) {
        aiStreamingIdx = messages.indexWhere(
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
    final pendingIdx = messages.indexWhere(
      (m) =>
          m.isPending &&
          m.id.startsWith('pending_') &&
          m.senderId == message.senderId &&
          m.content == message.content,
    );

    if (aiStreamingIdx != -1) {
      return ReconcileResult(
        messages: List.from(messages)..[aiStreamingIdx] = message,
        consumedAiPlaceholder: true,
      );
    } else if (pendingIdx != -1) {
      return ReconcileResult(
        messages: List.from(messages)..[pendingIdx] = message,
        consumedAiPlaceholder: false,
      );
    }
    return ReconcileResult(
      messages: [message, ...messages],
      consumedAiPlaceholder: false,
    );
  }

  /// Build the PinnedMessageModel list from pinned IDs using loaded messages.
  static List<PinnedMessageModel> buildPinned(
    List<MessageModel> messages,
    PinnedMessageEvent event,
  ) {
    final loadedById = {for (final m in messages) m.id: m};
    return event.pinnedMessageIds
        .map((id) => loadedById[id])
        .whereType<MessageModel>()
        .map((m) => PinnedMessageModel(
              id: m.id,
              senderId: m.senderId,
              content: m.content,
              createdAt: m.createdAt,
            ))
        .toList();
  }
}
