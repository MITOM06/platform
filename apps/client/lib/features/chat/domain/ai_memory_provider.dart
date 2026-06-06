import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/ai_memory_repository.dart';
import 'ai_memory_model.dart';

class AiMemoriesNotifier extends AsyncNotifier<List<AiMemoryModel>> {
  @override
  Future<List<AiMemoryModel>> build() async {
    return ref.read(aiMemoryRepositoryProvider).getMyMemories();
  }

  Future<void> deleteMemory(String conversationId) async {
    await ref.read(aiMemoryRepositoryProvider).deleteMemory(conversationId);
    state = AsyncData(
      (state.valueOrNull ?? [])
          .where((m) => m.conversationId != conversationId)
          .toList(),
    );
  }
}

final aiMemoriesProvider =
    AsyncNotifierProvider<AiMemoriesNotifier, List<AiMemoryModel>>(
  AiMemoriesNotifier.new,
);
