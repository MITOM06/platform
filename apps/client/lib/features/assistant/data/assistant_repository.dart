// lib/features/assistant/data/assistant_repository.dart
import 'package:dio/dio.dart';

class AssistantInfo {
  final String botUserId;
  final String name;
  final String? avatarUrl;

  /// The stored persona and model (`GET /api/assistant/me`), so setup/settings
  /// open pre-filled. Null for a legacy registration Bot Factory can't resolve.
  final String? systemPrompt;
  final String? providerId;

  const AssistantInfo({
    required this.botUserId,
    required this.name,
    this.avatarUrl,
    this.systemPrompt,
    this.providerId,
  });

  factory AssistantInfo.fromJson(Map<String, dynamic> json) => AssistantInfo(
        botUserId: json['botUserId'] as String,
        name: json['name'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        systemPrompt: json['systemPrompt'] as String?,
        providerId: json['providerId'] as String?,
      );
}

/// One selectable AI model exposed by the Bot Factory bridge.
class AssistantProvider {
  final String id;
  final String label;
  final String provider;
  final String model;

  const AssistantProvider({
    required this.id,
    required this.label,
    required this.provider,
    required this.model,
  });

  factory AssistantProvider.fromJson(Map<String, dynamic> json) =>
      AssistantProvider(
        id: json['id'] as String,
        label: json['label'] as String,
        provider: json['provider'] as String,
        model: json['model'] as String,
      );
}

/// `POST /api/assistant/setup` body — blank persona/model are left out so an
/// update keeps the stored ones instead of wiping them.
Map<String, dynamic> assistantSetupBody({
  required String name,
  String? systemPrompt,
  String? providerId,
}) {
  final prompt = systemPrompt?.trim() ?? '';
  final provider = providerId?.trim() ?? '';
  return {
    'name': name.trim(),
    if (prompt.isNotEmpty) 'systemPrompt': prompt,
    if (provider.isNotEmpty) 'providerId': provider,
  };
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

  /// The AI models the member can pick for their assistant. Coerces a missing
  /// or non-list body to an empty list (mirrors the web client).
  Future<List<AssistantProvider>> fetchProviders() async {
    final res =
        await _dio.get<List<dynamic>>('/api/assistant/providers');
    final data = res.data ?? const <dynamic>[];
    return data
        .map((e) => AssistantProvider.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Idempotent create-or-update. The response carries only `botUserId`+`name`
  /// (no avatar), so the returned [AssistantInfo] has a null avatarUrl.
  ///
  /// A blank [systemPrompt]/[providerId] is omitted: on an update the server
  /// keeps the stored value (a first setup without them is
  /// `400 ASSISTANT_SETUP_INCOMPLETE`).
  Future<AssistantInfo> setup({
    required String name,
    String? systemPrompt,
    String? providerId,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/assistant/setup',
      data: assistantSetupBody(
        name: name,
        systemPrompt: systemPrompt,
        providerId: providerId,
      ),
    );
    final body = res.data!;
    return AssistantInfo(
      botUserId: body['botUserId'] as String,
      name: body['name'] as String,
    );
  }

  Future<void> deleteAssistant() async {
    await _dio.delete<void>('/api/assistant/setup');
  }
}
