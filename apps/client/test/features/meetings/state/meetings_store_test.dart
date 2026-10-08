import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/meetings/domain/meeting_models.dart';
import 'package:platform_client/features/meetings/state/meetings_store.dart';

class _TestAuth extends AuthNotifier {
  @override
  Future<AuthState> build() async =>
      const AuthAuthenticated(UserModel(id: 'u1', email: 'a@acme.com', displayName: 'An'));

  void signOut() => state = const AsyncData(AuthUnauthenticated());
}

final _m1 = Meeting(
  id: 'm1',
  code: 'abc-defg-hjk',
  host: const MeetingPerson(userId: 'u1'),
  status: MeetingStatus.scheduled,
  viewerRole: MeetingViewerRole.host,
  createdAt: DateTime.utc(2026, 10, 7),
);

void main() {
  late ProviderContainer container;

  setUp(() {
    container = ProviderContainer(
        overrides: [authNotifierProvider.overrideWith(_TestAuth.new)]);
    addTearDown(container.dispose);
  });

  test('patches go through updateCache and land in byId / idByCode', () async {
    await container.read(authNotifierProvider.future);
    container.read(meetingsStoreProvider.notifier).updateCache((s) => s.put(_m1));
    final state = container.read(meetingsStoreProvider);
    expect(state.byId['m1'], same(_m1));
    expect(state.byCode('abc-defg-hjk'), same(_m1));
    expect(container.read(meetingsStoreProvider.notifier).cache, same(state));
  });

  test('signing out clears every cached meeting', () async {
    await container.read(authNotifierProvider.future);
    container.read(meetingsStoreProvider.notifier).updateCache((s) => s.put(_m1));
    (container.read(authNotifierProvider.notifier) as _TestAuth).signOut();
    await Future<void>.delayed(Duration.zero);
    expect(container.read(meetingsStoreProvider).byId, isEmpty);
  });

  test('MemoryMeetingsCache applies patches in place', () {
    final mem = MemoryMeetingsCache();
    mem.updateCache((s) => s.put(_m1));
    expect(mem.cache.byId.keys, ['m1']);
  });
}
