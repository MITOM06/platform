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

@immutable
class MessageUpdateEvent {
  final String conversationId;
  final String messageId;
  final String content;
  final DateTime editedAt;

  const MessageUpdateEvent({
    required this.conversationId,
    required this.messageId,
    required this.content,
    required this.editedAt,
  });
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
