import 'package:flutter/foundation.dart';

import 'chat_models.dart';

@immutable
class PresenceEvent {
  final String userId;
  final bool online;

  const PresenceEvent({required this.userId, required this.online});

  factory PresenceEvent.fromJson(Map<String, dynamic> json) => PresenceEvent(
        userId: json['userId'] as String,
        online: json['online'] as bool? ?? false,
      );
}

@immutable
class TypingEvent {
  final String userId;
  final String conversationId;
  final bool isTyping;

  const TypingEvent({
    required this.userId,
    required this.conversationId,
    required this.isTyping,
  });
}

@immutable
class ReadReceiptEvent {
  final String conversationId;
  final String messageId;
  final String readerId;

  const ReadReceiptEvent({
    required this.conversationId,
    required this.messageId,
    required this.readerId,
  });
}

@immutable
class ReactionUpdateEvent {
  final String conversationId;
  final String messageId;
  final List<ReactionModel> reactions;

  const ReactionUpdateEvent({
    required this.conversationId,
    required this.messageId,
    required this.reactions,
  });
}

@immutable
class RecallEvent {
  final String conversationId;
  final String messageId;

  const RecallEvent({required this.conversationId, required this.messageId});
}

/// `MESSAGE_UPDATED`. Two shapes share the event: a text edit (carries
/// `editedAt`) and an AI pending-action status change (carries
/// `pendingActions`, NO `editedAt` — the message was not edited).
@immutable
class MessageUpdateEvent {
  final String conversationId;
  final String messageId;
  final String? content;
  final DateTime? editedAt;
  // The AI message's full `pendingActions[]` after a status change
  // (sensitive-action confirmation cards); null when the event is a plain edit.
  final List<AiPendingAction>? pendingActions;

  const MessageUpdateEvent({
    required this.conversationId,
    required this.messageId,
    this.content,
    this.editedAt,
    this.pendingActions,
  });

  bool get isEdit => editedAt != null;
}

/// A `CONVERSATION_UPDATED` payload. chat-service sends two shapes:
/// - on `/topic/conversation/{id}` the SHARED fields only (never the viewer's
///   unread / mute / archive / block state) — [personal] is false;
/// - on `/user/queue/notifications` the actor's FULL view after a personal
///   action (mute, archive, read, …) — [personal] is true.
/// Clients merge [json] into their copy rather than replacing it.
@immutable
class ConversationUpdateEvent {
  final Map<String, dynamic> json;
  final bool personal;

  const ConversationUpdateEvent({required this.json, required this.personal});

  String? get conversationId => json['id'] as String?;
}

@immutable
class PinnedMessageEvent {
  final String conversationId;
  final List<String> pinnedMessageIds;

  const PinnedMessageEvent({
    required this.conversationId,
    required this.pinnedMessageIds,
  });
}
