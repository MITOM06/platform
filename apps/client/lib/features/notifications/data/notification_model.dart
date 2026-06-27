import 'package:flutter/foundation.dart';

/// In-app notification (friend request / accepted / system / password setup).
/// Lives on the auth-service (`/api/notifications`). Mirror of web
/// `AppNotification` in `apps/web/lib/api/notifications.ts`.
@immutable
class AppNotification {
  final String id;

  /// FRIEND_REQUEST | FRIEND_ACCEPTED | SYSTEM | PASSWORD_SETUP
  final String type;
  final String title;
  final String body;
  final String? actorId;
  final String? actorName;
  final String? actorAvatarUrl;

  /// For FRIEND_REQUEST this is the requester's userId (used to accept/decline).
  final String? relatedEntityId;
  final DateTime? readAt;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.actorId,
    this.actorName,
    this.actorAvatarUrl,
    this.relatedEntityId,
    this.readAt,
    required this.createdAt,
  });

  bool get isUnread => readAt == null;
  bool get isFriendRequest => type == 'FRIEND_REQUEST';

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(Object? v) =>
        v is String ? DateTime.tryParse(v) : null;
    return AppNotification(
      id: json['_id'] as String? ?? json['id'] as String,
      type: json['type'] as String? ?? 'SYSTEM',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      actorId: json['actorId'] as String?,
      actorName: json['actorName'] as String?,
      actorAvatarUrl: json['actorAvatarUrl'] as String?,
      relatedEntityId: json['relatedEntityId'] as String?,
      readAt: parseDate(json['readAt']),
      createdAt: parseDate(json['createdAt']) ?? DateTime.now(),
    );
  }

  AppNotification copyWith({DateTime? readAt}) => AppNotification(
        id: id,
        type: type,
        title: title,
        body: body,
        actorId: actorId,
        actorName: actorName,
        actorAvatarUrl: actorAvatarUrl,
        relatedEntityId: relatedEntityId,
        readAt: readAt ?? this.readAt,
        createdAt: createdAt,
      );
}
