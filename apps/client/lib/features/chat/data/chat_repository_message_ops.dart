part of 'chat_repository.dart';

/// Message-level operations: history, search, link preview, sending,
/// read receipts, pin/forward, reactions, feedback, edit/recall/delete.
extension ChatRepositoryMessageOps on ChatRepository {
  /// Cursor-based message history. Pass [before] = the oldest message id the
  /// caller already has to fetch the next older page; omit it for the newest
  /// page. Avoids the duplication/jumping of offset paging.
  Future<PagedResult<MessageModel>> getMessages(
    String conversationId, {
    String? before,
    int size = 20,
  }) async {
    final response = await _dio.get(
      '/api/conversations/$conversationId/messages',
      queryParameters: {
        if (before != null) 'before': before,
        'size': size,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final content = (data['content'] as List)
        .map((e) => MessageModel.fromJson(e as Map<String, dynamic>))
        .toList();
    return PagedResult(
      content: content,
      page: (data['page'] as num?)?.toInt() ?? 0,
      size: (data['size'] as num?)?.toInt() ?? size,
      totalElements: (data['totalElements'] as num?)?.toInt() ?? content.length,
      hasNext: data['hasNext'] as bool? ?? false,
    );
  }

  /// Catch-up fetch (Task 55): returns messages with createdAt > [afterTimestamp],
  /// oldest first. Called after STOMP reconnects to sync missed messages.
  Future<List<MessageModel>> getMessagesSince(
    String conversationId,
    DateTime afterTimestamp,
  ) async {
    final response = await _dio.get(
      '/api/conversations/$conversationId/messages',
      queryParameters: {'after': afterTimestamp.toUtc().toIso8601String()},
    );
    final data = response.data as Map<String, dynamic>;
    final content = (data['content'] as List)
        .map((e) => MessageModel.fromJson(e as Map<String, dynamic>))
        .toList();
    return content;
  }

  /// Search messages within a conversation by text (Task 50).
  Future<List<MessageModel>> searchMessages(
    String conversationId,
    String query,
  ) async {
    final response = await _dio.get(
      '/api/messages/search',
      queryParameters: {'q': query, 'conversationId': conversationId},
    );
    final list = response.data as List;
    return list
        .map((e) => MessageModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Fetch Open Graph metadata for a URL (server-side unfurl — bypasses CORS).
  Future<LinkPreviewData> fetchLinkPreview(String url) async {
    final response = await _dio.get(
      '/api/utils/link-preview',
      queryParameters: {'url': url},
    );
    return LinkPreviewData.fromJson(response.data as Map<String, dynamic>);
  }

  Future<MessageModel> sendMessageRest(
    String conversationId,
    String content, {
    String type = 'text',
    String? replyToId,
  }) async {
    final response = await _dio.post('/api/messages', data: {
      'conversationId': conversationId,
      'content': content,
      'type': type,
      if (replyToId != null) 'replyToId': replyToId,
    });
    return MessageModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> markAsRead(String messageId) async {
    await _dio.put('/api/messages/$messageId/read');
  }

  // ----- Task 53: Pin & Forward ---------------------------------------------

  Future<List<String>> pinMessage(String messageId) async {
    final response = await _dio.post('/api/messages/$messageId/pin');
    final data = response.data as Map<String, dynamic>;
    return List<String>.from(data['pinnedMessages'] as List? ?? []);
  }

  Future<List<String>> unpinMessage(String messageId) async {
    final response = await _dio.delete('/api/messages/$messageId/pin');
    final data = response.data as Map<String, dynamic>;
    return List<String>.from(data['pinnedMessages'] as List? ?? []);
  }

  Future<MessageModel> forwardMessage(
    String messageId,
    String targetConversationId,
  ) async {
    final response = await _dio.post(
      '/api/messages/$messageId/forward',
      data: {'targetConversationId': targetConversationId},
    );
    return MessageModel.fromJson(response.data as Map<String, dynamic>);
  }

  // ----- Message interactions -------------------------------------------

  Future<void> addReaction(String messageId, String emoji) async {
    await _dio.post('/api/messages/$messageId/reactions', data: {'emoji': emoji});
  }

  Future<void> removeReaction(String messageId) async {
    await _dio.delete('/api/messages/$messageId/reactions');
  }

  /// Submits 👍/👎 feedback for an AI answer. [rating] is "up", "down" or
  /// "none" (toggle off). Returns the persisted rating + optional comment.
  Future<({String rating, String? comment})> submitFeedback(
    String messageId,
    String rating, {
    String? comment,
  }) async {
    final response = await _dio.post(
      '/api/messages/$messageId/feedback',
      data: {
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
    final data = response.data as Map<String, dynamic>;
    return (
      rating: data['rating'] as String? ?? rating,
      comment: data['comment'] as String?,
    );
  }

  Future<void> recallMessage(String messageId) async {
    await _dio.delete('/api/messages/$messageId');
  }

  Future<MessageModel> editMessage(String messageId, String content) async {
    final response = await _dio.put(
      '/api/messages/$messageId',
      data: {'content': content},
    );
    return MessageModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteMessageForMe(String messageId) async {
    await _dio.post('/api/messages/$messageId/delete-for-me');
  }
}
