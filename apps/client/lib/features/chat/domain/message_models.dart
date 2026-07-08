import 'dart:convert';
import 'package:flutter/foundation.dart';

import 'ai_models.dart';

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
  final String type; // "text" | "image" | "system" | "ai" | etc.
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
  // Client-only: set when an optimistic STOMP send got no server echo within
  // the send watchdog window, so the bubble can show a tap-to-retry affordance.
  final bool sendFailed;
  // AI streaming state — client-only, not persisted
  final bool isStreaming;
  final bool isThinking;
  // RAG citation sources cited by the AI, from AI_STREAM_DONE payload
  final List<AiSource>? sources;
  // Agent trace — thinking blocks, tool calls, token usage; shown in trace panel below AI messages
  final AiTrace? trace;
  // Tools actively executing during streaming (client-only)
  final List<String> activeTools;
  // Subset of activeTools flagged sensitive (state-changing / outbound) by ai-service
  final List<String> sensitiveTools;

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
    this.sendFailed = false,
    this.isStreaming = false,
    this.isThinking = false,
    this.sources,
    this.trace,
    this.activeTools = const [],
    this.sensitiveTools = const [],
  });

  bool get isEdited => editedAt != null;

  bool get isSystem => type == 'system';
  bool get isAiMessage => type == 'ai';
  bool get isAiBot => senderId == kAiBotUserId;
  // Bot Factory personal-assistant bot — distinct from the native @AI bot and
  // from human senders. Identity (name/avatar) comes from GET /api/assistant/me.
  bool get isExternalBot => senderId.startsWith('extbot:');
  bool get isAiError => isAiMessage && content == kAiErrorSentinel;
  bool get isAiQuotaExceeded => isAiMessage && content == kAiQuotaExceededSentinel;
  bool get isAiStreamInterrupted => isAiMessage && content == kAiStreamInterruptedSentinel;
  bool get isAiUnavailable => isAiMessage && content == kAiUnavailableSentinel;
  bool get isAiRateLimited => isAiMessage && content == kAiRateLimitedSentinel;
  bool get isImage => type == 'image';
  bool get isVideo => type == 'video';
  bool get isMedia => isImage || isVideo;
  // Generic document attachment (PDF / DOC / ZIP …).
  bool get isFile => type == 'file';
  // Recorded voice audio (m4a/aac URL stored in content).
  bool get isVoice => type == 'voice';
  // Emoji sticker (emoji character stored in content).
  bool get isSticker => type == 'sticker';
  // Voice/video call log entry — cannot be pinned.
  bool get isCallLog => type == 'call_log';
  // AI meeting-summary card posted after a group call (content = JSON payload).
  bool get isMeetingSummary => type == 'meeting_summary';

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

  String get fileUrl => _fileMeta?['url']?.toString() ?? content;

  String get fileName {
    final name = _fileMeta?['name']?.toString();
    return (name != null && name.isNotEmpty) ? name : 'file';
  }

  /// File size in bytes. The backend UploadController serializes `size` as a
  /// STRING (`String.valueOf`), and web stores it as that string, while native
  /// uploads may store it as a number. Coerce BOTH so this never throws — an
  /// unchecked `as num` cast on a String payload would blow up the whole bubble
  /// into a red RenderErrorBox during build.
  int get fileSize {
    final raw = _fileMeta?['size'];
    if (raw is num) return raw.toInt();
    if (raw is String) return int.tryParse(raw) ?? 0;
    return 0;
  }

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'] as String? ?? '',
      conversationId: json['conversationId'] as String? ?? '',
      senderId: json['senderId'] as String? ?? '',
      content: json['content'] as String? ?? '',
      type: json['type'] as String? ?? 'text',
      readBy: List<String>.from(json['readBy'] as List? ?? []),
      createdAt: json['createdAt'] != null
          ? (DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now())
          : DateTime.now(),
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
    bool? sendFailed,
    bool? isStreaming,
    bool? isThinking,
    List<AiSource>? sources,
    AiTrace? trace,
    List<String>? activeTools,
    List<String>? sensitiveTools,
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
      sendFailed: sendFailed ?? this.sendFailed,
      isStreaming: isStreaming ?? this.isStreaming,
      isThinking: isThinking ?? this.isThinking,
      sources: sources ?? this.sources,
      trace: trace ?? this.trace,
      activeTools: activeTools ?? this.activeTools,
      sensitiveTools: sensitiveTools ?? this.sensitiveTools,
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
