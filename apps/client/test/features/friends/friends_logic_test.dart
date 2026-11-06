import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/chat_events.dart';
import 'package:platform_client/features/friends/data/friends_repository.dart';
import 'package:platform_client/features/friends/domain/friends_provider.dart';

import '../integrations/route_adapter.dart';

class _Stomp extends StompService {
  final ctrl = StreamController<PresenceEvent>.broadcast();
  var subscribed = 0;

  @override
  void build() {}

  @override
  Stream<PresenceEvent> get presence => ctrl.stream;

  @override
  void subscribePresence() => subscribed++;
}

Map<String, dynamic> _u(String id) =>
    {'_id': id, 'email': '$id@acme.com', 'displayName': 'User $id'};

void main() {
  group('FriendsRepository', () {
    test('routes and payloads for every friend / block action', () async {
      final a = RouteAdapter({
        'GET /api/users/u2/relationship':
            const Reply(200, {'friendStatus': 'incoming', 'blockedMe': true}),
        'DELETE /api/friends/u2': const Reply(200, {}),
        'POST /api/users/block/u2': const Reply(200, {}),
        'POST /api/users/unblock/u2': const Reply(200, {}),
        'POST /api/friends/request': const Reply(201, {}),
        'PUT /api/friends/accept': const Reply(200, {}),
        'GET /api/friends': Reply(200, [_u('f1')]),
        'GET /api/friends/requests': Reply(200, [
          {'friendshipId': 'fs1', 'requester': _u('r1')}
        ]),
        'GET /api/users/friends/online': Reply(200, [_u('o1')]),
      });
      final repo = FriendsRepository(dioWith(a));

      final rel = await repo.getRelationship('u2');
      expect(rel.isIncoming, isTrue);
      expect(rel.isFriend, isFalse);
      expect(rel.isBlockedEitherWay, isTrue);
      expect(rel.iBlocked, isFalse);

      await repo.removeFriend('u2');
      await repo.blockUser('u2');
      await repo.unblockUser('u2');
      await repo.sendRequest('u2');
      expect(a.requests.last.data, {'recipientId': 'u2'});
      await repo.acceptRequest('u2');
      expect(a.requests.last.data, {'requesterId': 'u2'});

      expect((await repo.getFriends()).single.id, 'f1');
      final reqs = await repo.getRequests();
      expect(reqs.single.friendshipId, 'fs1');
      expect(reqs.single.requester.displayName, 'User r1');
      expect((await repo.getOnlineFriends()).single.id, 'o1');

      expect(a.requests.map((r) => '${r.method} ${r.path}').take(5), [
        'GET /api/users/u2/relationship',
        'DELETE /api/friends/u2',
        'POST /api/users/block/u2',
        'POST /api/users/unblock/u2',
        'POST /api/friends/request',
      ]);
    });

    test('RelationshipState defaults: empty body → none, not blocked', () {
      final r = RelationshipState.fromJson(const {});
      expect(r.friendStatus, 'none');
      expect(r.isFriend || r.isOutgoing || r.isIncoming, isFalse);
      expect(r.isBlockedEitherWay, isFalse);
      expect(
          RelationshipState.fromJson(const {'friendStatus': 'outgoing', 'iBlocked': true})
              .isBlockedEitherWay,
          isTrue);
    });

    test('a failed block surfaces (not swallowed)', () async {
      final a = RouteAdapter({
        'POST /api/users/block/u2': const Reply(404, {'code': 'USER_NOT_FOUND'})
      });
      expect(FriendsRepository(dioWith(a)).blockUser('u2'),
          throwsA(isA<DioException>()));
    });
  });

  group('providers', () {
    test('list / requests / relationship read the repository', () async {
      final a = RouteAdapter({
        'GET /api/friends': Reply(200, [_u('f1'), _u('f2')]),
        'GET /api/friends/requests': const Reply(200, []),
        'GET /api/users/u9/relationship':
            const Reply(200, {'friendStatus': 'accepted'}),
      });
      final c = ProviderContainer(overrides: [
        friendsRepositoryProvider.overrideWithValue(FriendsRepository(dioWith(a))),
      ]);
      addTearDown(c.dispose);
      c.listen(friendsListProvider, (_, __) {});
      c.listen(friendRequestsProvider, (_, __) {});
      c.listen(relationshipProvider('u9'), (_, __) {});
      expect(await c.read(friendsListProvider.future), hasLength(2));
      expect(await c.read(friendRequestsProvider.future), isEmpty);
      expect((await c.read(relationshipProvider('u9').future)).isFriend, isTrue);
    });

    test('online friends: offline removes locally, online bursts refetch once',
        () {
      fakeAsync((async) {
        var fetches = 0;
        final a = RouteAdapter({
          'GET /api/users/friends/online': (RecordedRequest _) {
            fetches++;
            return Reply(200, fetches == 1 ? [_u('a'), _u('b')] : [_u('a'), _u('c')]);
          },
        });
        final stomp = _Stomp();
        final c = ProviderContainer(overrides: [
          friendsRepositoryProvider
              .overrideWithValue(FriendsRepository(dioWith(a))),
          stompServiceProvider.overrideWith(() => stomp),
        ]);
        c.listen(onlineFriendsNotifierProvider, (_, __) {});
        async.flushMicrotasks();
        async.elapse(Duration.zero);
        List<String> ids() => c
            .read(onlineFriendsNotifierProvider)
            .value!
            .map((u) => u.id)
            .toList();
        expect(stomp.subscribed, 1);
        expect(ids(), ['a', 'b']);

        // Offline: removed at once, no network.
        stomp.ctrl.add(const PresenceEvent(userId: 'b', online: false));
        async.flushMicrotasks();
        expect(ids(), ['a']);
        expect(fetches, 1);

        // Already listed online → ignored.
        stomp.ctrl.add(const PresenceEvent(userId: 'a', online: true));
        async.elapse(const Duration(milliseconds: 500));
        expect(fetches, 1);

        // A burst of online events → one debounced refetch.
        for (final id in ['c', 'd', 'e']) {
          stomp.ctrl.add(PresenceEvent(userId: id, online: true));
          async.elapse(const Duration(milliseconds: 100));
        }
        expect(fetches, 1);
        async.elapse(const Duration(milliseconds: 400));
        async.flushMicrotasks();
        expect(fetches, 2);
        expect(ids(), ['a', 'c']);

        c.dispose();
        // After dispose no more fetches even if events arrive.
        stomp.ctrl.add(const PresenceEvent(userId: 'z', online: true));
        async.elapse(const Duration(seconds: 1));
        expect(fetches, 2);
      });
    });
  });
}
