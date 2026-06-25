// lib/features/assistant/state/assistant_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../data/assistant_repository.dart';
import '../../../core/api/dio_client.dart';
import '../../auth/domain/auth_provider.dart';

/// Builds an [AssistantRepository] backed by a chat-service Dio. Mirrors
/// [chatRepositoryProvider] — there is no shared chat Dio provider, each
/// repository owns a Dio with the JWT/refresh/error interceptors.
final assistantRepositoryProvider = Provider<AssistantRepository>((ref) {
  const storage = FlutterSecureStorage();
  return AssistantRepository(
    DioClient.createChatDio(
      storage,
      onForceLogout: () =>
          ref.read(authNotifierProvider.notifier).forceLogout(),
    ),
  );
});

final assistantProvider =
    AsyncNotifierProvider<AssistantNotifier, AssistantInfo?>(
  AssistantNotifier.new,
);

class AssistantNotifier extends AsyncNotifier<AssistantInfo?> {
  @override
  Future<AssistantInfo?> build() =>
      ref.read(assistantRepositoryProvider).fetchAssistant();
}
