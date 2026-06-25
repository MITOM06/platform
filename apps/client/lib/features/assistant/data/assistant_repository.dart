// lib/features/assistant/data/assistant_repository.dart
import 'package:dio/dio.dart';

class AssistantInfo {
  final String botUserId;
  final String name;
  final String? avatarUrl;

  const AssistantInfo({
    required this.botUserId,
    required this.name,
    this.avatarUrl,
  });

  factory AssistantInfo.fromJson(Map<String, dynamic> json) => AssistantInfo(
        botUserId: json['botUserId'] as String,
        name: json['name'] as String,
        avatarUrl: json['avatarUrl'] as String?,
      );
}

class AssistantRepository {
  final Dio _dio;
  const AssistantRepository(this._dio);

  /// Returns null when no assistant is registered for the current member (404).
  Future<AssistantInfo?> fetchAssistant() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/api/assistant/me');
      return AssistantInfo.fromJson(res.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }
}
