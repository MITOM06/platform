// Guards the CRITICAL realtime bug: after the socket dropped (network loss,
// server restart) the auto-reconnect skipped every subscription because the
// stale handles were still registered — no messages, notifications or calls
// until an app restart. Also covers the frame router (no bogus bubbles from
// unknown events, optional MESSAGE_UPDATED.editedAt, merge-shaped
// CONVERSATION_UPDATED routing).

import 'package:flutter_test/flutter_test.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';

import 'package:platform_client/features/chat/data/stomp_streams.dart';
import 'package:platform_client/features/chat/data/stomp_subscription_registry.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';

/// Records every subscribe/unsubscribe like a socket would.
class _FakeSocket {
  final subscribed = <String>[];
  final unsubscribed = <String>[];

  StompUnsubscribe subscribe(String destination, StompFrameCallback _) {
    subscribed.add(destination);
    return ({Map<String, String>? unsubscribeHeaders}) =>
        unsubscribed.add(destination);
  }
}

void _noop(StompFrame _) {}

void main() {
  group('StompSubscriptionRegistry', () {
    test('re-subscribes every destination after the socket drops', () {
      final registry = StompSubscriptionRegistry();
      final first = _FakeSocket();
      registry.add('notif', '/user/queue/notifications', _noop,
          subscriber: first.subscribe);
      registry.add('msg_c1', '/topic/conversation/c1', _noop,
          subscriber: first.subscribe);
      expect(first.subscribed, hasLength(2));

      // Socket dies WITHOUT a client DISCONNECT (onWebSocketDone only) — the
      // old code never cleared its handles here.
      final second = _FakeSocket();
      registry.onConnected(second.subscribe);

      expect(second.subscribed,
          containsAll(['/user/queue/notifications', '/topic/conversation/c1']));
      expect(registry.activeKeys, {'notif', 'msg_c1'});
    });

    test('a desired destination added while offline subscribes on connect', () {
      final registry = StompSubscriptionRegistry();
      registry.add('presence', '/topic/presence', _noop);
      expect(registry.activeKeys, isEmpty);

      final socket = _FakeSocket();
      registry.onConnected(socket.subscribe);
      expect(socket.subscribed, ['/topic/presence']);
    });

    test('does not double-subscribe on the same socket', () {
      final registry = StompSubscriptionRegistry();
      final socket = _FakeSocket();
      registry.add('notif', '/user/queue/notifications', _noop,
          subscriber: socket.subscribe);
      registry.add('notif', '/user/queue/notifications', _noop,
          subscriber: socket.subscribe);
      expect(socket.subscribed, hasLength(1));
    });

    test('remove unsubscribes and is not re-subscribed later', () {
      final registry = StompSubscriptionRegistry();
      final socket = _FakeSocket();
      registry.add('msg_c1', '/topic/conversation/c1', _noop,
          subscriber: socket.subscribe);
      registry.remove('msg_c1', connected: true);
      expect(socket.unsubscribed, ['/topic/conversation/c1']);

      final next = _FakeSocket();
      registry.onConnected(next.subscribe);
      expect(next.subscribed, isEmpty);
    });

    test('remove while offline does not touch the dead handle', () {
      final registry = StompSubscriptionRegistry();
      final socket = _FakeSocket();
      registry.add('msg_c1', '/topic/conversation/c1', _noop,
          subscriber: socket.subscribe);
      registry.remove('msg_c1', connected: false);
      expect(socket.unsubscribed, isEmpty);
      expect(registry.desiredKeys, isEmpty);
    });

    test('clear (logout) forgets the previous account\'s subscriptions', () {
      final registry = StompSubscriptionRegistry();
      registry.add('msg_c1', '/topic/conversation/c1', _noop);
      registry.add('notif', '/user/queue/notifications', _noop);
      registry.clear();
      final socket = _FakeSocket();
      registry.onConnected(socket.subscribe);
      expect(socket.subscribed, isEmpty);
    });

    test('a subscribe that throws is retried on the next connect', () {
      final registry = StompSubscriptionRegistry();
      registry.add('notif', '/user/queue/notifications', _noop,
          subscriber: (_, __) => throw StateError('socket closed'));
      expect(registry.activeKeys, isEmpty);
      final socket = _FakeSocket();
      registry.onConnected(socket.subscribe);
      expect(socket.subscribed, ['/user/queue/notifications']);
    });
  });

  group('StompStreams routing', () {
    test('an unknown UPPER_CASE event is never parsed as a message', () async {
      final streams = StompStreams();
      final messages = <MessageModel>[];
      final sub = streams.messageCtrl.stream.listen(messages.add);
      streams.routeConversationFrame('c1', {'type': 'SOMETHING_NEW', 'x': 1});
      streams.routeConversationFrame('c1', {
        'id': 'm1',
        'conversationId': 'c1',
        'senderId': 'u1',
        'content': 'hi',
        'type': 'text',
      });
      await Future<void>.delayed(Duration.zero);
      expect(messages.map((m) => m.id), ['m1']);
      await sub.cancel();
    });

    test('MESSAGE_UPDATED without editedAt does not throw and is not an edit',
        () async {
      final streams = StompStreams();
      final events = <MessageUpdateEvent>[];
      final sub = streams.editCtrl.stream.listen(events.add);
      streams.routeConversationFrame('c1', {
        'type': 'MESSAGE_UPDATED',
        'messageId': 'm1',
        'conversationId': 'c1',
        'content': 'answer',
        'pendingActions': [
          {'id': 'a1', 'status': 'confirmed'}
        ],
      });
      await Future<void>.delayed(Duration.zero);
      expect(events.single.isEdit, isFalse);
      expect(events.single.pendingActions, hasLength(1));
      await sub.cancel();
    });

    test('CONVERSATION_UPDATED: topic = shared, user queue = personal',
        () async {
      final streams = StompStreams();
      final updates = <ConversationUpdateEvent>[];
      final notifs = <Map<String, dynamic>>[];
      final s1 = streams.convUpdateCtrl.stream.listen(updates.add);
      final s2 = streams.notifCtrl.stream.listen(notifs.add);
      streams.routeConversationFrame('c1', {
        'type': 'CONVERSATION_UPDATED',
        'conversation': {'id': 'c1', 'participants': <String>[]},
      });
      streams.routeUserQueueFrame({
        'type': 'CONVERSATION_UPDATED',
        'conversation': {'id': 'c1', 'isMuted': true},
      });
      streams.routeUserQueueFrame({'type': 'MESSAGE_REJECTED', 'code': 'X'});
      await Future<void>.delayed(Duration.zero);
      expect(updates.map((u) => u.personal), [false, true]);
      expect(notifs.single['type'], 'MESSAGE_REJECTED');
      await s1.cancel();
      await s2.cancel();
    });

    test('AI events are tagged with the topic conversation', () async {
      final streams = StompStreams();
      final ai = <Map<String, dynamic>>[];
      final sub = streams.aiStreamCtrl.stream.listen(ai.add);
      streams.routeConversationFrame(
          'c9', {'type': 'AI_STREAM_CHUNK', 'chunk': 'x', 'replyId': 'r1'});
      await Future<void>.delayed(Duration.zero);
      expect(ai.single['conversationId'], 'c9');
      await sub.cancel();
    });

    test('malformed frames are dropped instead of throwing', () {
      final streams = StompStreams();
      expect(
        () => streams.routeConversationFrame('c1', {'type': 'MESSAGE_READ'}),
        returnsNormally,
      );
      expect(StompStreams.decode('not json'), isNull);
    });
  });
}
