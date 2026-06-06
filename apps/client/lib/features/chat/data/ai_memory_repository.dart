import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/ai_memory_model.dart';

class AiMemoryRepository {
  final Dio _dio;

  const AiMemoryRepository(this._dio);

  Future<List<AiMemoryModel>> getMyMemories() async {
    final response = await _dio.get('/api/ai/memories');
    final data = response.data as List<dynamic>;
    return data
        .map((e) => AiMemoryModel.fromJson(e as Map<String, dynamic>))
        .toList();
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
