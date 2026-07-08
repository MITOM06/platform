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
      content: json['content'] as String? ?? '',
      senderId: json['senderId'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? (DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now())
          : DateTime.now(),
    );
  }
}

@immutable
class PinnedMessageModel {
  final String id;
  final String senderId;
  final String content;
  // Message type ("text" | "image" | "video" | "file" | "voice" | "sticker" |
  // "system" | …). Carried so previews can be humanized/sanitized instead of
  // leaking raw system codes, user ids, or media JSON/URLs (no-raw-system-data
  // rule). Backend ConversationResponse.PinnedMessageDto includes this.
  final String type;
  final DateTime? createdAt;

  const PinnedMessageModel({
    required this.id,
    required this.senderId,
    required this.content,
    this.type = 'text',
    this.createdAt,
  });

  factory PinnedMessageModel.fromJson(Map<String, dynamic> json) =>
      PinnedMessageModel(
        id: json['id'] as String,
        senderId: json['senderId'] as String,
        content: json['content'] as String? ?? '',
        type: json['type'] as String? ?? 'text',
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
  final bool isMuted;
  // Epoch-ms until which the conversation is muted. Null = not muted.
  // 9200000000000000 (9.2e15) = muted forever (MUTE_FOREVER sentinel).
  final int? muteExpiresAt;
  final bool isArchived;
  // Whether the current user has blocked and archived this conversation.
  final bool isBlocked;
  // Members invited to a group who have not yet accepted. While the current
  // user is in this list the conversation is a pending group invite (Requests
  // tab), not an active chat.
  final List<String> pendingMembers;
  // Shared per-conversation wallpaper (Issue 6). Null = default. Stored on the
  // Conversation document server-side and distributed via CONVERSATION_UPDATED.
  final String? wallpaper;

  static const int muteForeverSentinel = 9200000000000000;

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
    this.isMuted = false,
    this.muteExpiresAt,
    this.isArchived = false,
    this.isBlocked = false,
    this.pendingMembers = const [],
    this.wallpaper,
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
      isMuted: json['isMuted'] as bool? ?? false,
      muteExpiresAt: (json['muteExpiresAt'] as num?)?.toInt(),
      isArchived: json['isArchived'] as bool? ?? false,
      isBlocked: json['isBlocked'] as bool? ?? false,
      pendingMembers:
          List<String>.from(json['pendingMembers'] as List? ?? []),
      wallpaper: json['wallpaper'] as String?,
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
    bool? isMuted,
    int? muteExpiresAt,
    bool clearMuteExpiresAt = false,
    bool? isArchived,
    bool? isBlocked,
    List<String>? pendingMembers,
    String? wallpaper,
    bool clearWallpaper = false,
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
      isMuted: isMuted ?? this.isMuted,
      muteExpiresAt: clearMuteExpiresAt ? null : (muteExpiresAt ?? this.muteExpiresAt),
      isArchived: isArchived ?? this.isArchived,
      isBlocked: isBlocked ?? this.isBlocked,
      pendingMembers: pendingMembers ?? this.pendingMembers,
      wallpaper: clearWallpaper ? null : (wallpaper ?? this.wallpaper),
    );
  }
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
      userId: json['userId'] as String? ?? '',
      online: json['online'] as bool? ?? false,
      lastSeen: json['lastSeen'] != null
          ? DateTime.parse(json['lastSeen'] as String)
          : null,
    );
  }
}
