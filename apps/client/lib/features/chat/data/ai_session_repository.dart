import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/ai_session_model.dart';

/// Talks to the ai-service (:3002) session endpoints. Mirrors the web
/// `aiSessionApi`. A conversation (chat-service) owns many AI sessions; this
/// repository lists them and switches the active one.
class AiSessionRepository {
  final Dio _dio;

  const AiSessionRepository(this._dio);

  Future<List<AiSessionModel>> listSessions(String conversationId) async {
    final response = await _dio.get('/api/sessions/$conversationId');
    final data = response.data as List<dynamic>? ?? [];
    return data
        .map((e) => AiSessionModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<AiSessionModel> createNew(String conversationId) async {
    final response = await _dio.post('/api/sessions/$conversationId/new');
    return AiSessionModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<AiSessionModel> resume(
    String conversationId,
    String sessionId,
  ) async {
    final response =
        await _dio.post('/api/sessions/$conversationId/resume/$sessionId');
    final data = response.data;
    // Backend returns 404 when the session is missing/not owned; a null or
    // otherwise empty body must not be blind-cast to a Map (would _CastError).
    if (data is! Map<String, dynamic>) {
      throw StateError('Session $sessionId not found or empty response');
    }
    return AiSessionModel.fromJson(data);
  }
}

final aiSessionRepositoryProvider = Provider<AiSessionRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AiSessionRepository(
    DioClient.createAiDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
