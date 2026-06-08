import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/ai_persona_repository.dart';
import 'ai_persona_model.dart';

class AiPersonaNotifier
    extends FamilyAsyncNotifier<AiPersonaModel?, String> {
  @override
  Future<AiPersonaModel?> build(String arg) async {
    return ref.read(aiPersonaRepositoryProvider).getPersona(arg);
  }

  Future<void> save(Map<String, dynamic> body) async {
    final repo = ref.read(aiPersonaRepositoryProvider);
    final saved = await repo.upsertPersona(arg, body);
    state = AsyncData(saved);
  }

  Future<void> reset() async {
    await ref.read(aiPersonaRepositoryProvider).deletePersona(arg);
    state = const AsyncData(null);
  }
}

final aiPersonaProvider = AsyncNotifierProviderFamily<AiPersonaNotifier,
    AiPersonaModel?, String>(AiPersonaNotifier.new);
