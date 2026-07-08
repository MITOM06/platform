part of 'chat_repository.dart';

/// Conversation-level operations: listing, group management, lifecycle,
/// mute/archive/block, public channels and user status.
extension ChatRepositoryConversationOps on ChatRepository {
  Future<List<ConversationModel>> listConversations() async {
    final response = await _dio.get('/api/conversations');
    final data = response.data as Map<String, dynamic>;
    final content = data['content'] as List;
    return content
        .map((e) => ConversationModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Lists conversations the current user has archived.
  Future<List<ConversationModel>> listArchivedConversations() async {
    final response = await _dio.get(
      '/api/conversations',
      queryParameters: {'archived': true},
    );
    final data = response.data as Map<String, dynamic>;
    final content = data['content'] as List;
    return content
        .map((e) => ConversationModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Lists conversations the current user has blocked-archived.
  Future<List<ConversationModel>> listBlockedConversations() async {
    final response = await _dio.get(
      '/api/conversations',
      queryParameters: {'blocked': true},
    );
    final data = response.data as Map<String, dynamic>;
    final content = data['content'] as List;
    return content
        .map((e) => ConversationModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Move conversation to the Blocked section for the current user.
  Future<ConversationModel> blockArchiveConversation(String conversationId) async {
    final response = await _dio.post('/api/conversations/$conversationId/block-archive');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Restore conversation from Blocked section for the current user.
  Future<ConversationModel> blockRestoreConversation(String conversationId) async {
    final response = await _dio.post('/api/conversations/$conversationId/block-restore');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  // ----- Group management -----------------------------------------------

  Future<ConversationModel> createGroup(
    String name,
    List<String> participantIds, {
    String? avatarUrl,
    String? departmentId,
  }) async {
    final response = await _dio.post('/api/conversations/group', data: {
      'name': name,
      'avatarUrl': avatarUrl,
      'participantIds': participantIds,
      if (departmentId != null) 'departmentId': departmentId,
    });
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> getConversation(String conversationId) async {
    final response = await _dio.get('/api/conversations/$conversationId');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> updateConversation(
    String conversationId, {
    String? name,
    String? avatarUrl,
  }) async {
    final response = await _dio.put('/api/conversations/$conversationId', data: {
      if (name != null) 'name': name,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
    });
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Persists a shared per-conversation wallpaper (Issue 6). Allowed for any
  /// participant; the server broadcasts CONVERSATION_UPDATED so all members
  /// receive the new wallpaper in realtime. Pass an empty string to reset.
  Future<ConversationModel> setWallpaper(
    String conversationId,
    String wallpaper,
  ) async {
    final response = await _dio.put(
      '/api/conversations/$conversationId/wallpaper',
      data: {'wallpaper': wallpaper},
    );
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> addMembers(
    String conversationId,
    List<String> userIds,
  ) async {
    final response = await _dio.post(
      '/api/conversations/$conversationId/members',
      data: {'userIds': userIds},
    );
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> removeMember(
    String conversationId,
    String userId,
  ) async {
    final response = await _dio
        .delete('/api/conversations/$conversationId/members/$userId');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  // ----- Conversation lifecycle -----------------------------------------

  Future<void> deleteConversation(String conversationId) async {
    await _dio.delete('/api/conversations/$conversationId');
  }

  Future<void> clearHistory(String conversationId) async {
    await _dio.post('/api/conversations/$conversationId/clear');
  }

  Future<ConversationModel> acceptConversation(String conversationId) async {
    final response =
        await _dio.post('/api/conversations/$conversationId/accept');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> setAutoDelete(
    String conversationId,
    int? seconds,
  ) async {
    final response = await _dio.put(
      '/api/conversations/$conversationId/settings',
      data: {'autoDeleteSeconds': seconds},
    );
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// Mute conversation with a duration. [durationSeconds]: 900=15min,
  /// 1800=30min, 3600=1h, 86400=24h, -1=forever (until manual unmute).
  Future<ConversationModel> muteConversation(String conversationId,
      {int durationSeconds = -1}) async {
    final response = await _dio.post(
      '/api/conversations/$conversationId/mute',
      data: {'durationSeconds': durationSeconds},
    );
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> unmuteConversation(String conversationId) async {
    final response = await _dio.post('/api/conversations/$conversationId/unmute');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> archiveConversation(String conversationId) async {
    final response = await _dio.post('/api/conversations/$conversationId/archive');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> unarchiveConversation(String conversationId) async {
    final response = await _dio.post('/api/conversations/$conversationId/unarchive');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> markConversationUnread(String conversationId) async {
    final response = await _dio.post('/api/conversations/$conversationId/unread');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> markConversationRead(String conversationId) async {
    final response = await _dio.post('/api/conversations/$conversationId/read');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  // ----- Task 57: Shared Media Gallery --------------------------------------

  /// Returns messages of [type] ("media", "file", "link") for the gallery screen.
  Future<List<MessageModel>> getSharedAttachments(
    String conversationId,
    String type, {
    int page = 0,
    int size = 30,
  }) async {
    final response = await _dio.get(
      '/api/conversations/$conversationId/attachments',
      queryParameters: {'type': type, 'page': page, 'size': size},
    );
    final data = response.data as Map<String, dynamic>;
    final content = (data['content'] as List)
        .map((e) => MessageModel.fromJson(e as Map<String, dynamic>))
        .toList();
    return content;
  }

  // ----- Task 52: Public Channels -------------------------------------------

  Future<List<ConversationModel>> listPublicChannels({String? query}) async {
    final response = await _dio.get(
      '/api/conversations/public',
      queryParameters: {
        if (query != null && query.isNotEmpty) 'q': query,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final content = data['content'] as List;
    return content
        .map((e) => ConversationModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ConversationModel> joinChannel(String conversationId) async {
    final response =
        await _dio.post('/api/conversations/$conversationId/join');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<ConversationModel> getOrCreateConversation(
    String participantId,
  ) async {
    try {
      final response = await _dio.post(
        '/api/conversations',
        data: {'participantId': participantId},
      );
      return ConversationModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        final body = e.response!.data as Map<String, dynamic>;
        final existingId = body['conversationId'] as String;
        final conv = await _dio.get('/api/conversations/$existingId');
        return ConversationModel.fromJson(conv.data as Map<String, dynamic>);
      }
      rethrow;
    }
  }

  Future<UserStatus> getUserStatus(String userId) async {
    final response = await _dio.get('/api/users/$userId/status');
    return UserStatus.fromJson(response.data as Map<String, dynamic>);
  }
}
