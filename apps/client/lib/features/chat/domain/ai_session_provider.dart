import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/ai_session_repository.dart';
import 'ai_session_model.dart';

/// Sessions for a single AI conversation, keyed by conversationId. Newest /
/// active first (server already sorts). Exposes mutations that refresh the list
/// so the UI reflects the new active session.
class AiSessionsNotifier
    extends FamilyAsyncNotifier<List<AiSessionModel>, String> {
  String get _conversationId => arg;

  @override
  Future<List<AiSessionModel>> build(String conversationId) async {
    return ref
        .read(aiSessionRepositoryProvider)
        .listSessions(conversationId);
  }

  Future<void> _refresh() async {
    state = const AsyncLoading<List<AiSessionModel>>().copyWithPrevious(state);
    state = await AsyncValue.guard(
      () => ref.read(aiSessionRepositoryProvider).listSessions(_conversationId),
    );
  }

  /// Deactivate the current session and start a fresh active one. A failure is
  /// swallowed here (not rethrown) so the widget `onPressed` cannot produce an
  /// unhandled async error; the list still refreshes to reflect server state.
  Future<void> createNew() async {
    try {
      await ref.read(aiSessionRepositoryProvider).createNew(_conversationId);
    } catch (_) {
      // Surface via the refreshed list / error state below, not as a throw.
    }
    await _refresh();
  }

  /// Switch the active session to [sessionId]. Called directly from a widget
  /// `onPressed`, so a failure (e.g. 404 when the session was deleted, or a
  /// null body) must NOT escape as an unhandled async error. We catch it, keep
  /// the UI stable, and refresh the list so it reflects the real server state.
  Future<void> resume(String sessionId) async {
    try {
      await ref
          .read(aiSessionRepositoryProvider)
          .resume(_conversationId, sessionId);
    } catch (_) {
      // Session missing/not owned — refresh below drops the stale entry.
    }
    await _refresh();
  }
}

final aiSessionsProvider = AsyncNotifierProvider.family<AiSessionsNotifier,
    List<AiSessionModel>, String>(
  AiSessionsNotifier.new,
);
