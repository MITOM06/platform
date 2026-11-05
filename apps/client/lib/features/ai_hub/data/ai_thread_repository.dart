import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../../chat/domain/chat_state.dart';

/// chat-service `/api/ai-threads`: each "new chat" with the AI is its own
/// conversation. Mirrors web `aiThreadsApi`. Delete reuses the per-user
/// `ChatRepository.deleteConversation`.
class AiThreadRepository {
  final Dio _dio;

  const AiThreadRepository(this._dio);

  /// Caller's threads, newest activity first (max 100, hidden excluded).
  Future<List<ConversationModel>> list() async {
    final response = await _dio.get('/api/ai-threads');
    final data = response.data as List<dynamic>? ?? [];
    return data
        .map((e) => ConversationModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// A new, untitled thread (`name` null until auto-title / rename).
  Future<ConversationModel> create() async {
    final response = await _dio.post('/api/ai-threads');
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }

  /// 400 `AI_THREAD_NAME_INVALID` unless 1-80 chars after trim; 404 not mine.
  Future<ConversationModel> rename(String id, String name) async {
    final response = await _dio.patch(
      '/api/ai-threads/${Uri.encodeComponent(id)}',
      data: {'name': name},
    );
    return ConversationModel.fromJson(response.data as Map<String, dynamic>);
  }
}

final aiThreadRepositoryProvider = Provider<AiThreadRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AiThreadRepository(
    DioClient.createChatDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
