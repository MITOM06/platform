import 'chat_events.dart';
import 'chat_models.dart';

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

  /// Mark the matching message as recalled (clearing content + reactions),
  /// and blank every reply quote of it — a recalled message must not stay
  /// readable inside the replies to it.
  static List<MessageModel> applyRecall(
    List<MessageModel> messages,
    RecallEvent event,
  ) {
    return messages.map((m) {
      if (m.id == event.messageId) {
        return m.copyWith(recalled: true, content: '', reactions: const []);
      }
      final quote = m.replyPreview;
      if (quote != null && quote.messageId == event.messageId) {
        return m.copyWith(
          replyPreview: ReplyPreview(
            messageId: quote.messageId,
            senderId: quote.senderId,
            content: '',
            recalled: true,
          ),
        );
      }
      return m;
    }).toList();
  }

  /// Apply a MESSAGE_UPDATED to the matching message (and, for a real edit,
  /// to the reply quotes of it). An update without `editedAt` (AI
  /// pending-action status) never marks the message as edited; its
  /// `pendingActions` list is authoritative for the confirmation cards.
  static List<MessageModel> applyEdit(
    List<MessageModel> messages,
    MessageUpdateEvent event,
  ) {
    final content = event.content;
    final actions = event.pendingActions;
    return messages.map((m) {
      if (m.id == event.messageId) {
        return m.copyWith(
          content: event.isEdit ? content : null,
          editedAt: event.editedAt,
          pendingActions: actions == null
              ? null
              : applyServerPendingActions(m.pendingActions, actions),
        );
      }
      final quote = m.replyPreview;
      if (event.isEdit &&
          content != null &&
          quote != null &&
          quote.messageId == event.messageId &&
          !quote.recalled) {
        return m.copyWith(
          replyPreview: ReplyPreview(
            messageId: quote.messageId,
            senderId: quote.senderId,
            content: content,
          ),
        );
      }
      return m;
    }).toList();
  }

  /// Reconcile an incoming persisted [message] (non-AI, or an AI message no
  /// tracked reply claimed — see ChatAiStreamHandler.reconcilePersisted):
  /// - already in the list (STOMP echo of a REST send, a catch-up page racing
  ///   the live frame, a multi-instance duplicate) → replaced in place, never
  ///   shown twice;
  /// - else it replaces the matching optimistic (locally-echoed) message;
  /// - else it is prepended as new.
  static List<MessageModel> reconcileNewMessage(
    List<MessageModel> messages,
    MessageModel message,
  ) {
    final existingIdx = message.id.isEmpty
        ? -1
        : messages.indexWhere((m) => m.id == message.id);
    if (existingIdx != -1) {
      final existing = messages[existingIdx];
      return List.from(messages)
        ..[existingIdx] = message.copyWith(
          sources: message.sources ?? existing.sources,
          trace: message.trace ?? existing.trace,
          // The incoming copy is the newer server state of the cards.
          pendingActions: message.pendingActions == null
              ? existing.pendingActions
              : applyServerPendingActions(
                  existing.pendingActions, message.pendingActions!),
        );
    }

    // Replace the optimistic message if one matches by id-shape + sender +
    // content + type. Restrict to pending placeholders we created so we never
    // clobber a distinct real message that happens to share text.
    final pendingIdx = messages.indexWhere(
      (m) =>
          (m.isPending || m.sendFailed) &&
          m.id.startsWith('pending_') &&
          m.senderId == message.senderId &&
          m.type == message.type &&
          m.content == message.content,
    );
    if (pendingIdx != -1) {
      return List.from(messages)..[pendingIdx] = message;
    }
    return [message, ...messages];
  }

  /// The newest message the server has confirmed (cursor for the reconnect
  /// catch-up): skips optimistic sends, failed sends and AI placeholders,
  /// whose timestamps are local.
  static MessageModel? newestConfirmed(List<MessageModel> messages) {
    for (final m in messages) {
      if (m.isPending || m.sendFailed) continue;
      if (m.id.startsWith('pending_') ||
          m.id.startsWith('ai-pending-') ||
          m.id.startsWith('ai-stream-')) {
        continue;
      }
      return m;
    }
    return null;
  }

  /// Merges a catch-up page ([fresh], oldest first) into the newest-first
  /// list, skipping messages already present.
  static List<MessageModel> mergeCatchup(
    List<MessageModel> messages,
    List<MessageModel> fresh,
  ) {
    var out = messages;
    for (final m in fresh) {
      out = reconcileNewMessage(out, m);
    }
    return out;
  }

  /// Build the PinnedMessageModel list from pinned IDs using loaded messages,
  /// falling back to the [previous] pinned models (from the conversation
  /// payload) for pinned messages that are not loaded in the timeline.
  static List<PinnedMessageModel> buildPinned(
    List<MessageModel> messages,
    PinnedMessageEvent event, {
    List<PinnedMessageModel> previous = const [],
  }) {
    final loadedById = {for (final m in messages) m.id: m};
    final previousById = {for (final p in previous) p.id: p};
    final out = <PinnedMessageModel>[];
    for (final id in event.pinnedMessageIds) {
      final m = loadedById[id];
      if (m != null) {
        if (m.recalled) continue;
        out.add(PinnedMessageModel(
          id: m.id,
          senderId: m.senderId,
          content: m.content,
          // Carry type so previews stay sanitized (no raw system codes /
          // media JSON) for realtime-pinned messages too.
          type: m.type,
          createdAt: m.createdAt,
        ));
      } else {
        final prev = previousById[id];
        if (prev != null) out.add(prev);
      }
    }
    return out;
  }
}
