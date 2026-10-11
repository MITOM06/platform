import 'package:flutter/foundation.dart';

import 'chat_state.dart';

/// A `NEW_MESSAGE` / `MENTIONED_YOU` on `/user/queue/notifications`:
/// `{type, conversationId, senderId, senderName, content, messageType,
/// messageId, createdAt}`. System notices (group created, members added /
/// left / removed / joined, auto-delete, admin changes) arrive in the same
/// full shape, sent by "system"; older servers sent only
/// `{type, conversationId, senderName: "system"}` (no preview to show).
@immutable
class IncomingMessageNotice {
  const IncomingMessageNotice({
    required this.conversationId,
    required this.senderId,
    this.senderName,
    this.content,
    this.messageType,
    this.messageId,
    this.createdAt,
  });

  final String conversationId;

  /// The sender's id; `system` for a system notice that names none.
  final String senderId;
  final String? senderName;
  final String? content;
  final String? messageType;
  final String? messageId;
  final DateTime? createdAt;

  /// Null without a conversation id.
  static IncomingMessageNotice? fromJson(Map<String, dynamic> json) {
    final conversationId = _text(json['conversationId']);
    if (conversationId == null) return null;
    final senderName = _text(json['senderName']);
    final messageType = _text(json['messageType']);
    final isSystem = messageType == 'system' || senderName == _systemSender;
    final createdAt = _text(json['createdAt']);
    final content = json['content'];
    return IncomingMessageNotice(
      conversationId: conversationId,
      // Legacy payloads carried the sender in senderName only.
      senderId: _text(json['senderId']) ??
          (isSystem ? _systemSender : senderName ?? ''),
      senderName: senderName,
      content: content is String ? content : null,
      messageType: messageType,
      messageId: _text(json['messageId']),
      createdAt: createdAt == null ? null : DateTime.tryParse(createdAt),
    );
  }

  static const _systemSender = 'system';

  static String? _text(Object? v) => v is String && v.isNotEmpty ? v : null;
}

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
