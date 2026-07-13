import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import 'ai_context_models.dart';

/// Reads/writes the role-aware AI context via auth-service (:3001, `/ai-context`).
class AiContextRepository {
  final Dio _dio;

  const AiContextRepository(this._dio);

  Future<MyAiContext> getMine() async {
    final r = await _dio.get('/ai-context/me');
    return MyAiContext.fromJson((r.data as Map).cast<String, dynamic>());
  }

  Future<AiUserContext> updateMyStyle({String? style, String? preferences}) async {
    final r = await _dio.patch('/ai-context/me/style', data: {
      if (style != null) 'style': style,
      if (preferences != null) 'preferences': preferences,
    });
    return AiUserContext.fromJson((r.data as Map).cast<String, dynamic>());
  }

  Future<AiUserContext> getUser(String userId) async {
    final r = await _dio.get('/ai-context/users/$userId');
    return AiUserContext.fromJson((r.data as Map).cast<String, dynamic>());
  }

  Future<AiUserContext> updateUserHard(
    String userId, {
    String? jobTitle,
    List<String>? projects,
  }) async {
    final r = await _dio.patch('/ai-context/users/$userId/hard', data: {
      if (jobTitle != null) 'jobTitle': jobTitle,
      if (projects != null) 'projects': projects,
    });
    return AiUserContext.fromJson((r.data as Map).cast<String, dynamic>());
  }

  Future<List<AiContextEntry>> listEntries(String scope, {String? scopeId}) async {
    final r = await _dio.get('/ai-context/entries', queryParameters: {
      'scope': scope,
      if (scopeId != null) 'scopeId': scopeId,
    });
    return ((r.data as List?) ?? const [])
        .map((e) => AiContextEntry.fromJson((e as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<AiContextEntry> createEntry(Map<String, dynamic> body) async {
    final r = await _dio.post('/ai-context/entries', data: body);
    return AiContextEntry.fromJson((r.data as Map).cast<String, dynamic>());
  }

  Future<AiContextEntry> updateEntry(String id, Map<String, dynamic> body) async {
    final r = await _dio.patch('/ai-context/entries/$id', data: body);
    return AiContextEntry.fromJson((r.data as Map).cast<String, dynamic>());
  }

  Future<void> deleteEntry(String id) async {
    await _dio.delete('/ai-context/entries/$id');
  }
}

final aiContextRepositoryProvider = Provider<AiContextRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AiContextRepository(
    DioClient.createAuthDio(
      storage,
      onForceLogout: () => ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
