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

  /// Deactivate the current session and start a fresh active one. Never
  /// throws (it runs from a widget `onPressed`): the failure is RETURNED so
  /// the caller can show a localized message, and the list still refreshes to
  /// reflect server state. Null on success.
  Future<Object?> createNew() async {
    Object? failure;
    try {
      await ref.read(aiSessionRepositoryProvider).createNew(_conversationId);
    } catch (e) {
      failure = e;
    }
    await _refresh();
    return failure;
  }

  /// Switch the active session to [sessionId]. Like [createNew], a failure
  /// (e.g. 404 when the session was deleted) is returned, not thrown, and the
  /// refresh drops the stale entry. Null on success.
  Future<Object?> resume(String sessionId) async {
    Object? failure;
    try {
      await ref
          .read(aiSessionRepositoryProvider)
          .resume(_conversationId, sessionId);
    } catch (e) {
      failure = e;
    }
    await _refresh();
    return failure;
  }
}

final aiSessionsProvider = AsyncNotifierProvider.family<AiSessionsNotifier,
    List<AiSessionModel>, String>(
  AiSessionsNotifier.new,
);
