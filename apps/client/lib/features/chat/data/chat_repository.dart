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

  Future<PagedResult<MessageModel>> getMessages(
    String conversationId,
    int page,
    int size,
  ) async {
    final response = await _dio.get(
      '/api/conversations/$conversationId/messages',
      queryParameters: {'page': page, 'size': size},
    );
    final data = response.data as Map<String, dynamic>;
    final content = (data['content'] as List)
        .map((e) => MessageModel.fromJson(e as Map<String, dynamic>))
        .toList();
    return PagedResult(
      content: content,
      page: (data['page'] as num).toInt(),
      size: (data['size'] as num).toInt(),
      totalElements: (data['totalElements'] as num).toInt(),
    );
  }

  Future<MessageModel> sendMessageRest(
    String conversationId,
    String content, {
    String? replyToId,
  }) async {
    final response = await _dio.post('/api/messages', data: {
      'conversationId': conversationId,
      'content': content,
      'type': 'text',
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
    // không có filesystem) lẫn mobile, hỗ trợ mọi định dạng ảnh.
    final bytes = await file.readAsBytes();
    final filename = file.name;
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: filename,
        contentType: _imageMediaType(filename),
      ),
    });
    final response = await _dio.post('/api/uploads', data: formData);
    final data = response.data as Map<String, dynamic>;
    return data['url'] as String;
  }

  DioMediaType? _imageMediaType(String filename) {
    final ext = filename.toLowerCase().split('.').last;
    switch (ext) {
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
