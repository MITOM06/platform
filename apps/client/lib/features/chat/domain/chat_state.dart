import 'package:flutter/foundation.dart';

import 'chat_models.dart';

// Data models and STOMP event classes were split out for the clean-code file
// limit. Re-exported here so existing importers of chat_state.dart are
// unaffected.
export 'chat_models.dart';
export 'chat_events.dart';

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
  // AI persona for this conversation (AI-6.5). Defaults to 'PON AI'.
  final String aiPersonaName;
  final String? aiPersonaAvatarUrl;

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
    this.aiPersonaName = 'PON AI',
    this.aiPersonaAvatarUrl,
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
    String? aiPersonaName,
    String? aiPersonaAvatarUrl,
    bool clearAiPersonaAvatarUrl = false,
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
      aiPersonaName: aiPersonaName ?? this.aiPersonaName,
      aiPersonaAvatarUrl: clearAiPersonaAvatarUrl
          ? null
          : (aiPersonaAvatarUrl ?? this.aiPersonaAvatarUrl),
    );
  }
}
