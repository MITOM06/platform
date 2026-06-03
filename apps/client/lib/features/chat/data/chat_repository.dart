import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart' show XFile;
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/chat_state.dart';

class ChatRepository {
  final Dio _dio;

  const ChatRepository(this._dio);

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

  // ----- Group management -----------------------------------------------

  Future<ConversationModel> createGroup(
    String name,
    List<String> participantIds, {
    String? avatarUrl,
  }) async {
    final response = await _dio.post('/api/conversations/group', data: {
      'name': name,
      'avatarUrl': avatarUrl,
      'participantIds': participantIds,
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

  Future<ConversationModel> muteConversation(String conversationId) async {
    final response = await _dio.post('/api/conversations/$conversationId/mute');
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

  Future<String> uploadFile(XFile file) async {
    // Đọc bytes thay vì fromFile(path) để hoạt động trên cả web (blob URL,
    // không có filesystem) lẫn mobile, hỗ trợ ảnh lẫn video.
    final bytes = await file.readAsBytes();
    final filename = file.name;
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: filename,
        contentType: _mediaMediaType(filename),
      ),
    });
    final response = await _dio.post('/api/uploads', data: formData);
    final data = response.data as Map<String, dynamic>;
    return data['url'] as String;
  }

  /// Upload a generic document (PDF / DOC / ZIP …). Returns the stored url plus
  /// filename and size so the caller can build a "file card" message.
  Future<({String url, String name, int size})> uploadDocument(
    List<int> bytes,
    String filename,
  ) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });
    final response = await _dio.post('/api/uploads', data: formData);
    final data = response.data as Map<String, dynamic>;
    final returnedName = data['filename'] as String?;
    return (
      url: data['url'] as String,
      name: (returnedName != null && returnedName.isNotEmpty)
          ? returnedName
          : filename,
      size: int.tryParse(data['size']?.toString() ?? '') ?? bytes.length,
    );
  }

  DioMediaType? _mediaMediaType(String filename) {
    final ext = filename.toLowerCase().split('.').last;
    switch (ext) {
      // Ảnh
      case 'png':
        return DioMediaType('image', 'png');
      case 'jpg':
      case 'jpeg':
        return DioMediaType('image', 'jpeg');
      case 'gif':
        return DioMediaType('image', 'gif');
      case 'webp':
        return DioMediaType('image', 'webp');
      case 'bmp':
        return DioMediaType('image', 'bmp');
      case 'heic':
        return DioMediaType('image', 'heic');
      case 'heif':
        return DioMediaType('image', 'heif');
      // Video
      case 'mp4':
        return DioMediaType('video', 'mp4');
      case 'mov':
        return DioMediaType('video', 'quicktime');
      case 'webm':
        return DioMediaType('video', 'webm');
      case 'mkv':
        return DioMediaType('video', 'x-matroska');
      case 'avi':
        return DioMediaType('video', 'x-msvideo');
      case 'm4v':
        return DioMediaType('video', 'x-m4v');
      case '3gp':
        return DioMediaType('video', '3gpp');
      default:
        return null;
    }
  }
}

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  const storage = FlutterSecureStorage();
  return ChatRepository(
    DioClient.createChatDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
