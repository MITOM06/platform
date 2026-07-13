import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/ai_memory_repository.dart';
import 'ai_memory_model.dart';

/// P2b: memory is a single global per-user aggregate (nullable when empty).
class AiMemoriesNotifier extends AsyncNotifier<AiMemoryModel?> {
  @override
  Future<AiMemoryModel?> build() async {
    return ref.read(aiMemoryRepositoryProvider).getMyMemories();
  }

  Future<void> deleteMemory(String conversationId) async {
    await ref.read(aiMemoryRepositoryProvider).deleteMemory(conversationId);
    ref.invalidateSelf();
    await future;
  }
}

final aiMemoriesProvider =
    AsyncNotifierProvider<AiMemoriesNotifier, AiMemoryModel?>(
  AiMemoriesNotifier.new,
);
