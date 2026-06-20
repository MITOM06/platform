import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../../integrations/data/connector_repository.dart';

/// Resolves the current authenticated user's id, or throws if unauthenticated.
String _requireUserId(Ref ref) {
  final auth = ref.read(authNotifierProvider).valueOrNull;
  if (auth is AuthAuthenticated) return auth.user.id;
  throw StateError('not-authenticated');
}

/// Loads persisted skill toggles as a `{skillId: enabled}` map and exposes an
/// optimistic [setSkill] that persists via `PUT /skills`.
class SkillsNotifier extends AsyncNotifier<Map<String, bool>> {
  @override
  Future<Map<String, bool>> build() => _load();

  Future<Map<String, bool>> _load() async {
    final repo = ref.read(connectorRepositoryProvider);
    _requireUserId(ref); // fail fast if unauthenticated; identity comes from JWT
    final skills = await repo.getSkills();
    return {for (final s in skills) s.skillId: s.enabled};
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }

  /// Optimistically flip [skillId]; revert + rethrow-as-error on failure.
  Future<void> setSkill(String skillId, bool enabled) async {
    final current = Map<String, bool>.from(state.valueOrNull ?? {});
    final previous = current[skillId] ?? false;
    current[skillId] = enabled;
    state = AsyncData(current);
    try {
      await ref.read(connectorRepositoryProvider).setSkill(
            skillId: skillId,
            enabled: enabled,
          );
    } catch (_) {
      final reverted = Map<String, bool>.from(state.valueOrNull ?? {});
      reverted[skillId] = previous;
      state = AsyncData(reverted);
      rethrow;
    }
  }
}

final skillsProvider =
    AsyncNotifierProvider<SkillsNotifier, Map<String, bool>>(
  SkillsNotifier.new,
);
