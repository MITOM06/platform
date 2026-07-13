import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/ai_context_models.dart';
import '../data/ai_context_repository.dart';

/// Current user's AI context (identity + profile + role-filtered entries).
class MyAiContextNotifier extends AsyncNotifier<MyAiContext> {
  @override
  Future<MyAiContext> build() =>
      ref.read(aiContextRepositoryProvider).getMine();

  Future<void> updateStyle({String? style, String? preferences}) async {
    await ref
        .read(aiContextRepositoryProvider)
        .updateMyStyle(style: style, preferences: preferences);
    ref.invalidateSelf();
    await future;
  }
}

final myAiContextProvider =
    AsyncNotifierProvider<MyAiContextNotifier, MyAiContext>(
  MyAiContextNotifier.new,
);

/// A single member's AI user context (admin/manager view of hard fields).
final memberAiContextProvider =
    FutureProvider.family<AiUserContext, String>((ref, userId) {
  return ref.read(aiContextRepositoryProvider).getUser(userId);
});

/// Company/department context entries for the admin editor, keyed by scope+id.
typedef EntriesKey = ({String scope, String? scopeId});

final contextEntriesProvider =
    FutureProvider.family<List<AiContextEntry>, EntriesKey>((ref, key) {
  return ref
      .read(aiContextRepositoryProvider)
      .listEntries(key.scope, scopeId: key.scopeId);
});
