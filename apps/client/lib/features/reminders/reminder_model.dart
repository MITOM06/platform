import 'package:flutter/foundation.dart';

@immutable
class ReminderModel {
  final String id;
  final String userId;
  final String conversationId;
  final String text;
  final DateTime remindAt;
  final bool done;
  final DateTime createdAt;

  const ReminderModel({
    required this.id,
    required this.userId,
    required this.conversationId,
    required this.text,
    required this.remindAt,
    required this.done,
    required this.createdAt,
  });

  factory ReminderModel.fromJson(Map<String, dynamic> json) => ReminderModel(
        id: json['id'] as String,
        userId: json['userId'] as String,
        conversationId: json['conversationId'] as String,
        text: json['text'] as String,
        remindAt: DateTime.parse(json['remindAt'] as String),
        done: json['done'] as bool? ?? false,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
