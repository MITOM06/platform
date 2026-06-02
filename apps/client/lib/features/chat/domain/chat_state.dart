import 'dart:convert';
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
class PinnedMessageModel {
  final String id;
  final String senderId;
  final String content;
  final DateTime? createdAt;

  const PinnedMessageModel({
    required this.id,
    required this.senderId,
    required this.content,
    this.createdAt,
  });

  factory PinnedMessageModel.fromJson(Map<String, dynamic> json) =>
      PinnedMessageModel(
        id: json['id'] as String,
        senderId: json['senderId'] as String,
        content: json['content'] as String? ?? '',
        createdAt: json['createdAt'] != null
            ? DateTime.parse(json['createdAt'] as String)
            : null,
      );
}

@immutable
class ConversationModel {
  final String id;
  final String type; // "direct" | "group"
  final String? name; // group name
  final String? avatarUrl; // group avatar
  final List<String> participants;
  final List<String> admins;
  final String? createdBy;
  final int? autoDeleteSeconds;
  final LastMessageModel? lastMessage;
  final DateTime? lastMessageAt;
  final int unreadCount;
  final DateTime createdAt;
  final String status; // "pending" | "accepted"
  final bool isPublic; // public discoverable channel (Task 52)
  final List<PinnedMessageModel> pinnedMessages; // pinned messages (Task 53)

  const ConversationModel({
    required this.id,
    this.type = 'direct',
    this.name,
    this.avatarUrl,
    required this.participants,
    this.admins = const [],
    this.createdBy,
    this.autoDeleteSeconds,
    this.lastMessage,
    this.lastMessageAt,
    required this.unreadCount,
    required this.createdAt,
    this.status = 'accepted',
    this.isPublic = false,
    this.pinnedMessages = const [],
  });

  bool get isGroup => type == 'group';
  bool get isPending => status == 'pending';

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    return ConversationModel(
      id: json['id'] as String,
      type: json['type'] as String? ?? 'direct',
      name: json['name'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      participants: List<String>.from(json['participants'] as List? ?? []),
      admins: List<String>.from(json['admins'] as List? ?? []),
      createdBy: json['createdBy'] as String?,
      autoDeleteSeconds: (json['autoDeleteSeconds'] as num?)?.toInt(),
      lastMessage: json['lastMessage'] != null
          ? LastMessageModel.fromJson(
              json['lastMessage'] as Map<String, dynamic>)
          : null,
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.parse(json['lastMessageAt'] as String)
          : null,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      status: json['status'] as String? ?? 'accepted',
      isPublic: json['isPublic'] as bool? ?? false,
      pinnedMessages: (json['pinnedMessages'] as List? ?? [])
          .map((e) =>
              PinnedMessageModel.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  ConversationModel copyWith({
    String? id,
    String? type,
    String? name,
    String? avatarUrl,
    List<String>? participants,
    List<String>? admins,
    String? createdBy,
    int? autoDeleteSeconds,
    LastMessageModel? lastMessage,
    DateTime? lastMessageAt,
    int? unreadCount,
    DateTime? createdAt,
    String? status,
    bool? isPublic,
    List<PinnedMessageModel>? pinnedMessages,
  }) {
    return ConversationModel(
      id: id ?? this.id,
      type: type ?? this.type,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      participants: participants ?? this.participants,
      admins: admins ?? this.admins,
      createdBy: createdBy ?? this.createdBy,
      autoDeleteSeconds: autoDeleteSeconds ?? this.autoDeleteSeconds,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
      createdAt: createdAt ?? this.createdAt,
      status: status ?? this.status,
      isPublic: isPublic ?? this.isPublic,
      pinnedMessages: pinnedMessages ?? this.pinnedMessages,
    );
  }
}

@immutable
class ReactionModel {
  final String userId;
  final String emoji;

  const ReactionModel({required this.userId, required this.emoji});

  factory ReactionModel.fromJson(Map<String, dynamic> json) => ReactionModel(
        userId: json['userId'] as String,
        emoji: json['emoji'] as String,
      );
}

@immutable
class ReplyPreview {
  final String? messageId;
  final String senderId;
  final String content;

  const ReplyPreview({
    this.messageId,
    required this.senderId,
    required this.content,
  });

  factory ReplyPreview.fromJson(Map<String, dynamic> json) => ReplyPreview(
        messageId: json['messageId'] as String?,
        senderId: json['senderId'] as String? ?? '',
        content: json['content'] as String? ?? '',
      );
}

@immutable
class MessageModel {
  final String id;
  final String conversationId;
  final String senderId;
  final String content;
  final String type; // "text" | "image" | "system"
  final List<String> readBy;
  final DateTime createdAt;
  final String? replyToId;
  final ReplyPreview? replyPreview;
  final List<ReactionModel> reactions;
  final bool recalled;
  // Set when the sender has edited this message (null = never edited).
  final DateTime? editedAt;
  // User ids @-mentioned in this message (Task 49).
  final List<String> mentions;
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
    this.replyToId,
    this.replyPreview,
    this.reactions = const [],
    this.recalled = false,
    this.editedAt,
    this.mentions = const [],
    this.isPending = false,
  });

  bool get isEdited => editedAt != null;

  bool get isSystem => type == 'system';
  bool get isImage => type == 'image';
  bool get isVideo => type == 'video';
  bool get isMedia => isImage || isVideo;
  // Generic document attachment (PDF / DOC / ZIP …).
  bool get isFile => type == 'file';

  /// File messages encode `{url, name, size}` as JSON in [content]. These
  /// getters decode it defensively (falling back to the raw content as a URL).
  Map<String, dynamic>? get _fileMeta {
    if (!isFile) return null;
    try {
      final decoded = jsonDecode(content);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  String get fileUrl => (_fileMeta?['url'] as String?) ?? content;
  String get fileName => (_fileMeta?['name'] as String?) ?? 'file';
  int get fileSize => (_fileMeta?['size'] as num?)?.toInt() ?? 0;

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderId: json['senderId'] as String,
      content: json['content'] as String? ?? '',
      type: json['type'] as String? ?? 'text',
      readBy: List<String>.from(json['readBy'] as List? ?? []),
      createdAt: DateTime.parse(json['createdAt'] as String),
      replyToId: json['replyToId'] as String?,
      replyPreview: json['replyPreview'] != null
          ? ReplyPreview.fromJson(json['replyPreview'] as Map<String, dynamic>)
          : null,
      reactions: (json['reactions'] as List? ?? [])
          .map((e) => ReactionModel.fromJson(e as Map<String, dynamic>))
          .toList(),
      recalled: json['recalled'] as bool? ?? false,
      editedAt: json['editedAt'] != null
          ? DateTime.parse(json['editedAt'] as String)
          : null,
      mentions: List<String>.from(json['mentions'] as List? ?? []),
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
    String? replyToId,
    ReplyPreview? replyPreview,
    List<ReactionModel>? reactions,
    bool? recalled,
    DateTime? editedAt,
    List<String>? mentions,
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
      replyToId: replyToId ?? this.replyToId,
      replyPreview: replyPreview ?? this.replyPreview,
      reactions: reactions ?? this.reactions,
      recalled: recalled ?? this.recalled,
      editedAt: editedAt ?? this.editedAt,
      mentions: mentions ?? this.mentions,
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
  // Whether an older page of history exists (cursor pagination).
  final bool hasNext;

  const PagedResult({
    required this.content,
    required this.page,
    required this.size,
    required this.totalElements,
    this.hasNext = false,
  });
}

/// Open Graph metadata for a link, fetched from the chat-service unfurl endpoint.
@immutable
class LinkPreviewData {
  final String url;
  final String? title;
  final String? description;
  final String? image;
  final String? siteName;

  const LinkPreviewData({
    required this.url,
    this.title,
    this.description,
    this.image,
    this.siteName,
  });

  // A preview is only worth rendering if it has at least a title or image.
  bool get hasContent =>
      (title != null && title!.isNotEmpty) ||
      (image != null && image!.isNotEmpty);

  factory LinkPreviewData.fromJson(Map<String, dynamic> json) => LinkPreviewData(
        url: json['url'] as String? ?? '',
        title: json['title'] as String?,
        description: json['description'] as String?,
        image: json['image'] as String?,
        siteName: json['siteName'] as String?,
      );
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

@immutable
class ChatState {
  final List<MessageModel> messages;
  final bool hasMore;
  final int currentPage;
  final Set<String> typingUserIds;
  final bool isLoadingMore;
  // Message the composer is currently replying to (null = not replying).
  final MessageModel? replyingTo;
  // Message the composer is currently editing (null = not editing).
  final MessageModel? editingMessage;
  // Message id to scroll to + briefly highlight after a search jump (Task 50).
  final String? highlightMessageId;
  // Pinned messages for this conversation (Task 53). First = shown in header bar.
  final List<PinnedMessageModel> pinnedMessages;

  const ChatState({
    required this.messages,
    required this.hasMore,
    this.currentPage = 0,
    this.typingUserIds = const {},
    this.isLoadingMore = false,
    this.replyingTo,
    this.editingMessage,
    this.highlightMessageId,
    this.pinnedMessages = const [],
  });

  ChatState copyWith({
    List<MessageModel>? messages,
    bool? hasMore,
    int? currentPage,
    Set<String>? typingUserIds,
    bool? isLoadingMore,
    MessageModel? replyingTo,
    bool clearReplyingTo = false,
    MessageModel? editingMessage,
    bool clearEditingMessage = false,
    String? highlightMessageId,
    bool clearHighlight = false,
    List<PinnedMessageModel>? pinnedMessages,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      hasMore: hasMore ?? this.hasMore,
      currentPage: currentPage ?? this.currentPage,
      typingUserIds: typingUserIds ?? this.typingUserIds,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      replyingTo: clearReplyingTo ? null : (replyingTo ?? this.replyingTo),
      editingMessage: clearEditingMessage
          ? null
          : (editingMessage ?? this.editingMessage),
      highlightMessageId:
          clearHighlight ? null : (highlightMessageId ?? this.highlightMessageId),
      pinnedMessages: pinnedMessages ?? this.pinnedMessages,
    );
  }
}
