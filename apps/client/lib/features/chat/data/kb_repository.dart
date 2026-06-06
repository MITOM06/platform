import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/kb_document_model.dart';

class KbRepository {
  final Dio _dio;

  const KbRepository(this._dio);

  Future<KbDocumentModel> uploadDocument({
    required String conversationId,
    required String fileUrl,
    required String fileName,
    required String mimeType,
  }) async {
    final response = await _dio.post('/api/kb/documents', data: {
      'conversationId': conversationId,
      'fileUrl': fileUrl,
      'fileName': fileName,
      'mimeType': mimeType,
    });
    return KbDocumentModel.fromJson(response.data as Map<String, dynamic>);
  }

  Future<List<KbDocumentModel>> getDocuments(String conversationId) async {
    final response = await _dio.get(
      '/api/kb/documents',
      queryParameters: {'conversationId': conversationId},
    );
    final list = response.data as List? ?? [];
    return list.map((e) => KbDocumentModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> deleteDocument(String documentId) async {
    await _dio.delete('/api/kb/documents/$documentId');
  }
}

final kbRepositoryProvider = Provider<KbRepository>((ref) {
  const storage = FlutterSecureStorage();
  return KbRepository(
    DioClient.createChatDio(
      storage,
      onForceLogout: () => ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
