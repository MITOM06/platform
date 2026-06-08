import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/ai_persona_model.dart';

class AiPersonaRepository {
  final Dio _dio;

  AiPersonaRepository(this._dio);

  Future<AiPersonaModel?> getPersona(String conversationId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/conversations/$conversationId/ai-persona',
      );
      if (response.data == null) return null;
      return AiPersonaModel.fromJson(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<AiPersonaModel> upsertPersona(
      String conversationId, Map<String, dynamic> body) async {
    final response = await _dio.put<Map<String, dynamic>>(
      '/api/conversations/$conversationId/ai-persona',
      data: body,
    );
    return AiPersonaModel.fromJson(response.data!);
  }

  Future<void> deletePersona(String conversationId) async {
    await _dio.delete<void>('/api/conversations/$conversationId/ai-persona');
  }
}

final aiPersonaRepositoryProvider = Provider<AiPersonaRepository>((ref) {
  const storage = FlutterSecureStorage();
  final dio = DioClient.createChatDio(
    storage,
    onForceLogout: () => ref.read(authNotifierProvider.notifier).forceLogout(),
  );
  return AiPersonaRepository(dio);
});
