import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/notifications/data/notification_model.dart';
import 'package:platform_client/features/notifications/data/notification_repository.dart';
import 'package:platform_client/features/notifications/domain/notifications_provider.dart';

import '../integrations/route_adapter.dart';

class _Auth extends AuthNotifier {
  _Auth(this._s);
  final AuthState _s;
  @override
  Future<AuthState> build() async => _s;
}

Map<String, dynamic> _n(String id, {String? readAt, String type = 'SYSTEM'}) => {
      '_id': id,
      'type': type,
      'title': 'T$id',
      'body': 'B$id',
      'readAt': readAt,
      'createdAt': '2026-11-01T10:00:00Z',
    };

ProviderContainer _container(RouteAdapter a, {bool signedIn = true}) {
  final c = ProviderContainer(overrides: [
    authNotifierProvider.overrideWith(() => _Auth(signedIn
        ? const AuthAuthenticated(
            UserModel(id: 'u1', email: 'a@b.c', displayName: 'A'))
        : const AuthUnauthenticated())),
    notificationRepositoryProvider
        .overrideWithValue(NotificationRepository(dioWith(a))),
  ]);
  c.listen(authNotifierProvider, (_, __) {});
  return c;
}

void main() {
  group('AppNotification.fromJson', () {
    test('defaults: missing type → SYSTEM, bad dates tolerated', () {
      final n = AppNotification.fromJson(const {
        'id': 'n1',
        'readAt': 12,
        'createdAt': 'garbage',
      });
      expect(n.type, 'SYSTEM');
      expect(n.title, '');
      expect(n.isUnread, isTrue);
      expect(n.isFriendRequest, isFalse);
      expect(n.createdAt.difference(DateTime.now()).inSeconds.abs(), lessThan(5));
    });

    test('friend request + copyWith keeps every field', () {
      final n = AppNotification.fromJson({
        ..._n('n2', type: 'FRIEND_REQUEST'),
        'actorId': 'u9',
        'actorName': 'Bob',
        'relatedEntityId': 'u9',
      });
      expect(n.isFriendRequest, isTrue);
      final read = n.copyWith(readAt: DateTime.utc(2026));
      expect(read.isUnread, isFalse);
      expect(read.actorName, 'Bob');
      expect(read.relatedEntityId, 'u9');
      expect(read.copyWith().readAt, DateTime.utc(2026));
    });
  });

  test('signed out: no request at all, empty list, no polling', () {
    fakeAsync((async) {
      final a = RouteAdapter();
      final c = _container(a, signedIn: false);
      async.elapse(const Duration(milliseconds: 1)); // session restored first (router splash)
      c.listen(notificationsProvider, (_, __) {});
      async.elapse(const Duration(milliseconds: 1));
      expect(c.read(notificationsProvider).value, isEmpty);
      async.elapse(const Duration(minutes: 2));
      c.read(notificationsProvider.notifier).refreshSilently();
      async.elapse(const Duration(milliseconds: 1));
      expect(a.requests, isEmpty);
      c.dispose();
    });
  });

  test('signed in: loads, counts unread, polls every 30 s, stops on dispose', () {
    fakeAsync((async) {
      final a = RouteAdapter({
        'GET /api/notifications': Reply(200, [
          _n('a'),
          _n('b', readAt: '2026-11-01T11:00:00Z'),
          _n('c'),
        ]),
      });
      final c = _container(a);
      async.elapse(const Duration(milliseconds: 1)); // session restored first (router splash)
      c.listen(notificationsProvider, (_, __) {});
      async.elapse(const Duration(milliseconds: 1));
      expect(c.read(notificationsProvider).value, hasLength(3));
      expect(c.read(unreadNotificationCountProvider), 2);
      expect(a.requests, hasLength(1));

      async.elapse(const Duration(seconds: 30));
      async.elapse(const Duration(milliseconds: 1));
      expect(a.requests, hasLength(2));
      async.elapse(const Duration(seconds: 60));
      async.elapse(const Duration(milliseconds: 1));
      expect(a.requests, hasLength(4));

      c.dispose();
      async.elapse(const Duration(minutes: 5));
      expect(a.requests, hasLength(4));
    });
  });

  test('a failed poll keeps the last list; first-load failure shows the error',
      () {
    fakeAsync((async) {
      var fail = false;
      final a = RouteAdapter({
        'GET /api/notifications': (RecordedRequest _) =>
            fail ? const Reply(500, {}) : Reply(200, [_n('a')]),
      });
      final c = _container(a);
      async.elapse(const Duration(milliseconds: 1)); // session restored first (router splash)
      c.listen(notificationsProvider, (_, __) {});
      async.elapse(const Duration(milliseconds: 1));
      fail = true;
      c.read(notificationsProvider.notifier).refresh();
      async.elapse(const Duration(milliseconds: 1));
      expect(c.read(notificationsProvider).hasError, isFalse);
      expect(c.read(notificationsProvider).value!.single.id, 'a');
      c.dispose();

      final c2 = _container(a);
      async.elapse(const Duration(milliseconds: 1));
      c2.listen(notificationsProvider, (_, __) {});
      async.elapse(const Duration(milliseconds: 1));
      expect(c2.read(notificationsProvider).hasError, isTrue);
      expect(c2.read(unreadNotificationCountProvider), 0);
      c2.dispose();
    });
  });

  test('markRead / markAllRead are optimistic and survive a server error', () {
    fakeAsync((async) {
      final a = RouteAdapter({
        'GET /api/notifications': Reply(200, [_n('a'), _n('b'), _n('c')]),
        'POST /api/notifications/a/read': const Reply(500, {}),
        'POST /api/notifications/read-all': const Reply(200, {}),
      });
      final c = _container(a);
      async.elapse(const Duration(milliseconds: 1)); // session restored first (router splash)
      c.listen(notificationsProvider, (_, __) {});
      async.elapse(const Duration(milliseconds: 1));

      c.read(notificationsProvider.notifier).markRead('a');
      // Optimistic before the request even completes.
      expect(c.read(unreadNotificationCountProvider), 2);
      async.elapse(const Duration(milliseconds: 1));
      expect(c.read(notificationsProvider).value!.first.isUnread, isFalse);
      expect(a.calls('POST', '/api/notifications/a/read'), hasLength(1));

      c.read(notificationsProvider.notifier).markAllRead();
      async.elapse(const Duration(milliseconds: 1));
      expect(c.read(unreadNotificationCountProvider), 0);
      expect(a.calls('POST', '/api/notifications/read-all'), hasLength(1));
      c.dispose();
    });
  });
}
