import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';
import '../domain/ai_action_card_logic.dart';

/// Confirms / cancels a sensitive AI action held for in-chat confirmation
/// (CONTRACTS-ROUND2 §F2). Routes live on ai-service (`AppConfig.aiBaseUrl`;
/// through the mini's Caddy that is `/api/ai/ai/actions/...`). Neither call
/// sends a body: confirm runs the input stored when the AI prepared the action.
class AiActionsRepository {
  final Dio _dio;

  const AiActionsRepository(this._dio);

  /// `POST /ai/actions/:id/confirm` → `{status: confirmed|failed}`.
  Future<ActionCardKind?> confirm(String id) async {
    final res = await _dio.post('/ai/actions/${Uri.encodeComponent(id)}/confirm');
    return actionOutcomeFromResponse(res.data);
  }

  /// `POST /ai/actions/:id/cancel` → `{status: cancelled}`.
  Future<ActionCardKind?> cancel(String id) async {
    final res = await _dio.post('/ai/actions/${Uri.encodeComponent(id)}/cancel');
    return actionOutcomeFromResponse(res.data);
  }
}

final aiActionsRepositoryProvider = Provider<AiActionsRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AiActionsRepository(
    DioClient.createAiDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});
