import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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
    String content,
  ) async {
    final response = await _dio.post('/api/messages', data: {
      'conversationId': conversationId,
      'content': content,
      'type': 'text',
    });
    return MessageModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> markAsRead(String messageId) async {
    await _dio.put('/api/messages/$messageId/read');
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
