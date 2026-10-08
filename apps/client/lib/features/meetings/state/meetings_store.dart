import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/domain/auth_provider.dart';
import '../../auth/domain/auth_state.dart';
import '../domain/cache_updates.dart';

/// Where meeting patches land — the Riverpod store in the app, an in-memory
/// cache in unit tests (room controller, personal queue).
abstract interface class MeetingsCacheSink {
  MeetingsCacheState get cache;
  void updateCache(MeetingsCacheState Function(MeetingsCacheState) fn);
}

/// The one normalized meetings cache (web: TanStack `setQueryData`). Lives for
/// the whole session; emptied when the signed-in account goes away so the
/// next account never sees the previous one's meetings.
class MeetingsStore extends Notifier<MeetingsCacheState>
    implements MeetingsCacheSink {
  @override
  MeetingsCacheState build() {
    ref.listen<AsyncValue<AuthState>>(authNotifierProvider, (prev, next) {
      final before = prev?.valueOrNull;
      final after = next.valueOrNull;
      final prevId = before is AuthAuthenticated ? before.user.id : null;
      final nextId = after is AuthAuthenticated ? after.user.id : null;
      if (prevId != null && prevId != nextId) {
        state = const MeetingsCacheState();
      }
    });
    return const MeetingsCacheState();
  }

  @override
  MeetingsCacheState get cache => state;

  @override
  void updateCache(MeetingsCacheState Function(MeetingsCacheState) fn) =>
      state = fn(state);
}

/// keepAlive (a plain [NotifierProvider] is never auto-disposed).
final meetingsStoreProvider =
    NotifierProvider<MeetingsStore, MeetingsCacheState>(MeetingsStore.new);

/// In-memory sink for unit tests.
class MemoryMeetingsCache implements MeetingsCacheSink {
  @override
  MeetingsCacheState cache = const MeetingsCacheState();

  @override
  void updateCache(MeetingsCacheState Function(MeetingsCacheState) fn) =>
      cache = fn(cache);
}
