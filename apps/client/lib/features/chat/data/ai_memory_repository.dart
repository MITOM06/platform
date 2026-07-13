import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/ai_memory_model.dart';

class AiMemoryRepository {
  final Dio _dio;

  const AiMemoryRepository(this._dio);

  // P2b: returns ONE aggregated per-user object (not an array).
  Future<AiMemoryModel?> getMyMemories() async {
    final response = await _dio.get('/api/ai/memories');
    final data = response.data;
    if (data is! Map) return null;
    return AiMemoryModel.fromJson(data.cast<String, dynamic>());
  }

  Future<AiMemoryModel?> getConversationMemory(String conversationId) async {
    final response = await _dio.get('/api/ai/memories/$conversationId');
    return AiMemoryModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> deleteMemory(String conversationId) async {
    await _dio.delete('/api/ai/memories/$conversationId');
  }
}

final aiMemoryRepositoryProvider = Provider<AiMemoryRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AiMemoryRepository(
    DioClient.createChatDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
