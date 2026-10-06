import 'chat_state.dart';

/// What a `CONVERSATION_UPDATED` did to the conversation list.
enum ConversationMergeOutcome {
  /// The matching conversation was merged in place.
  updated,

  /// The update no longer lists the current user as a participant (removed /
  /// left the group): the conversation was dropped from the list.
  removedMe,

  /// The conversation is not in the list yet (e.g. just added to a group, or a
  /// conversation beyond the loaded page) — the caller should fetch it.
  unknown,

  /// Nothing to do (malformed payload).
  ignored,
}

class ConversationMergeResult {
  final List<ConversationModel> conversations;
  final ConversationMergeOutcome outcome;
  final String? conversationId;

  const ConversationMergeResult(
    this.conversations,
    this.outcome, {
    this.conversationId,
  });
}

/// Pure transforms over the conversation list, kept out of
/// [ConversationsNotifier] so the merge rules are unit-testable.
class ConversationListOps {
  const ConversationListOps._();

  /// Applies a `CONVERSATION_UPDATED` payload (see [ConversationUpdateEvent]).
  static ConversationMergeResult merge(
    List<ConversationModel> list,
    ConversationUpdateEvent event, {
    required String? currentUserId,
  }) {
    final id = event.conversationId;
    if (id == null || id.isEmpty) {
      return ConversationMergeResult(list, ConversationMergeOutcome.ignored);
    }
    final participants = event.json['participants'];
    if (currentUserId != null &&
        currentUserId.isNotEmpty &&
        participants is List &&
        !participants.contains(currentUserId)) {
      return ConversationMergeResult(
        list.where((c) => c.id != id).toList(),
        ConversationMergeOutcome.removedMe,
        conversationId: id,
      );
    }
    final idx = list.indexWhere((c) => c.id == id);
    if (idx < 0) {
      return ConversationMergeResult(list, ConversationMergeOutcome.unknown,
          conversationId: id);
    }
    final next = List<ConversationModel>.from(list);
    next[idx] = list[idx].mergeJson(event.json);
    return ConversationMergeResult(next, ConversationMergeOutcome.updated,
        conversationId: id);
  }

  /// Inserts [conv] (or replaces the copy with the same id) keeping the list
  /// ordered by most recent activity.
  static List<ConversationModel> upsertSorted(
    List<ConversationModel> list,
    ConversationModel conv,
  ) {
    final rest = list.where((c) => c.id != conv.id).toList();
    final at = _activity(conv);
    final pos = rest.indexWhere((c) => _activity(c).isBefore(at));
    if (pos < 0) return [...rest, conv];
    return [...rest.sublist(0, pos), conv, ...rest.sublist(pos)];
  }

  static DateTime _activity(ConversationModel c) =>
      c.lastMessageAt ?? c.lastMessage?.createdAt ?? c.createdAt;

  /// A NEW_MESSAGE / MENTIONED_YOU notification for [conversationId]: bump it
  /// to the front with the new preview. The unread badge only grows when the
  /// user is NOT looking at that conversation right now ([viewing]).
  ///
  /// Returns null when the conversation is not in the list.
  static List<ConversationModel>? applyIncomingMessage(
    List<ConversationModel> list, {
    required String conversationId,
    required String senderId,
    required bool viewing,
    String? content,
    String? messageType,
    String? messageId,
    DateTime? createdAt,
    DateTime? now,
  }) {
    final idx = list.indexWhere((c) => c.id == conversationId);
    if (idx < 0) return null;
    final at = createdAt ?? now ?? DateTime.now();
    final current = list[idx];
    final target = current.copyWith(
      lastMessageAt: at,
      unreadCount: viewing ? 0 : current.unreadCount + 1,
      lastMessage: content != null
          ? LastMessageModel(
              content: content,
              senderId: senderId,
              createdAt: at,
              type: messageType,
              messageId: messageId,
            )
          : current.lastMessage,
    );
    return [
      target,
      for (int i = 0; i < list.length; i++)
        if (i != idx) list[i],
    ];
  }
}
