import 'package:flutter/foundation.dart';

@immutable
class LastMessageModel {
  final String content;
  final String senderId;
  final DateTime createdAt;

  const LastMessageModel({
    required this.content,
    required this.senderId,
    required this.createdAt,
  });

  factory LastMessageModel.fromJson(Map<String, dynamic> json) {
    return LastMessageModel(
      content: json['content'] as String,
      senderId: json['senderId'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

@immutable
class ConversationModel {
  final String id;
  final List<String> participants;
  final LastMessageModel? lastMessage;
  final DateTime? lastMessageAt;
  final int unreadCount;
  final DateTime createdAt;

  const ConversationModel({
    required this.id,
    required this.participants,
    this.lastMessage,
    this.lastMessageAt,
    required this.unreadCount,
    required this.createdAt,
  });

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    return ConversationModel(
      id: json['id'] as String,
      participants: List<String>.from(json['participants'] as List),
      lastMessage: json['lastMessage'] != null
          ? LastMessageModel.fromJson(
              json['lastMessage'] as Map<String, dynamic>)
          : null,
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.parse(json['lastMessageAt'] as String)
          : null,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  ConversationModel copyWith({
    String? id,
    List<String>? participants,
    LastMessageModel? lastMessage,
    DateTime? lastMessageAt,
    int? unreadCount,
    DateTime? createdAt,
  }) {
    return ConversationModel(
      id: id ?? this.id,
      participants: participants ?? this.participants,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

@immutable
class MessageModel {
  final String id;
  final String conversationId;
  final String senderId;
  final String content;
  final String type;
  final List<String> readBy;
  final DateTime createdAt;
  // Client-only flag for optimistic UI — not in server response
  final bool isPending;

  const MessageModel({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.content,
    required this.type,
    required this.readBy,
    required this.createdAt,
    this.isPending = false,
  });

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderId: json['senderId'] as String,
      content: json['content'] as String,
      type: json['type'] as String? ?? 'text',
      readBy: List<String>.from(json['readBy'] as List? ?? []),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  MessageModel copyWith({
    String? id,
    String? conversationId,
    String? senderId,
    String? content,
    String? type,
    List<String>? readBy,
    DateTime? createdAt,
    bool? isPending,
  }) {
    return MessageModel(
      id: id ?? this.id,
      conversationId: conversationId ?? this.conversationId,
      senderId: senderId ?? this.senderId,
      content: content ?? this.content,
      type: type ?? this.type,
      readBy: readBy ?? this.readBy,
      createdAt: createdAt ?? this.createdAt,
      isPending: isPending ?? this.isPending,
    );
  }
}

@immutable
class PagedResult<T> {
  final List<T> content;
  final int page;
  final int size;
  final int totalElements;

  const PagedResult({
    required this.content,
    required this.page,
    required this.size,
    required this.totalElements,
  });
}

@immutable
class UserStatus {
  final String userId;
  final bool online;
  final DateTime? lastSeen;

  const UserStatus({
    required this.userId,
    required this.online,
    this.lastSeen,
  });

  factory UserStatus.fromJson(Map<String, dynamic> json) {
    return UserStatus(
      userId: json['userId'] as String,
      online: json['online'] as bool,
      lastSeen: json['lastSeen'] != null
          ? DateTime.parse(json['lastSeen'] as String)
          : null,
    );
  }
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
class ChatState {
  final List<MessageModel> messages;
  final bool hasMore;
  final int currentPage;
  final Set<String> typingUserIds;
  final bool isLoadingMore;

  const ChatState({
    required this.messages,
    required this.hasMore,
    this.currentPage = 0,
    this.typingUserIds = const {},
    this.isLoadingMore = false,
  });

  ChatState copyWith({
    List<MessageModel>? messages,
    bool? hasMore,
    int? currentPage,
    Set<String>? typingUserIds,
    bool? isLoadingMore,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      hasMore: hasMore ?? this.hasMore,
      currentPage: currentPage ?? this.currentPage,
      typingUserIds: typingUserIds ?? this.typingUserIds,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    );
  }
}
