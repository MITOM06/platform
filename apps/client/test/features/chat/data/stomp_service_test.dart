// StompService against a real in-process STOMP server (fake_stomp_server.dart):
// auth headers, subscribe/route/unsubscribe, sends, re-subscribe after the
// socket drops, forced token refresh after an ERROR frame, logout when the
// refresh is rejected, and stopping the reconnect loop without a session.

import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:platform_client/core/config/app_config.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/chat_state.dart';

import 'fake_stomp_server.dart';

class _Auth extends AuthNotifier {
  int forcedLogouts = 0;
  @override
  Future<AuthState> build() async => const AuthUnauthenticated();
  @override
  void forceLogout() => forcedLogouts++;
}

String _jwt(Duration validFor, {String sub = 'u1'}) {
  String seg(Map<String, Object> m) =>
      base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  final exp = DateTime.now().add(validFor).millisecondsSinceEpoch ~/ 1000;
  return '${seg({'alg': 'HS256'})}.${seg({'sub': sub, 'exp': exp})}.sig';
}

void main() {
  late FakeStompServer server;
  late ProviderContainer c;
  late StompService stomp;
  late _Auth auth;

  Future<void> setUpWith(Map<String, String> storage) async {
    FlutterSecureStorage.setMockInitialValues(storage);
    server = FakeStompServer();
    await server.start();
    AppConfig.useDevHost(server.devHost);
    auth = _Auth();
    c = ProviderContainer(overrides: [
      authNotifierProvider.overrideWith(() => auth),
    ]);
    stomp = c.read(stompServiceProvider.notifier);
  }

  tearDown(() async {
    stomp.resetSession();
    c.dispose();
    AppConfig.useDevHost(null);
    await server.close();
  });

  group('offline (never connected)', () {
    setUp(() => setUpWith({}));

    test('sends are dropped safely and isConnected is false', () {
      expect(stomp.isConnected, isFalse);
      stomp.sendMessage('c1', 'x');
      stomp.sendTyping('c1', isTyping: true);
      stomp.sendRead('c1', 'm1');
      stomp.sendRawMessage(destination: '/app/x', body: '{}');
      stomp.unsubscribeConversation('never-subscribed');
      stomp.unsubscribeMeetingTopic('m1');
      expect(server.frames, isEmpty);
    });
  });

  group('connected', () {
    late String token;

    setUp(() async {
      token = _jwt(const Duration(hours: 1));
      await setUpWith({'accessToken': token});
    });

    Future<void> connectNow() async {
      await stomp.connect(token);
      await waitUntil(() => stomp.isConnected);
    }

    test('connects with the Bearer token on the upgrade AND the CONNECT frame',
        () async {
      final states = <bool>[];
      final sub = stomp.connectionChanges.listen(states.add);
      await connectNow();
      expect(server.upgradeAuth.single, 'Bearer $token');
      expect(server.of('CONNECT').single.headers['Authorization'],
          'Bearer $token');
      await waitUntil(() => states.isNotEmpty);
      expect(states, [true]);
      await sub.cancel();

      // A second connect while connected is a no-op.
      await stomp.connect(token);
      expect(server.socketCount, 1);
    });

    test('desired subscriptions made offline are subscribed on connect',
        () async {
      stomp.subscribeConversation('c1');
      stomp.subscribePresence();
      await connectNow();
      await waitUntil(() => server.of('SUBSCRIBE').length == 3);
      expect(server.subscribedDestinations(), containsAll([
        '/topic/conversation/c1',
        '/topic/conversation/c1/typing',
        '/topic/presence',
      ]));
    });

    test('conversation frames are routed to the right typed streams',
        () async {
      await connectNow();
      stomp.subscribeConversation('c1');
      await waitUntil(() => server.of('SUBSCRIBE').length == 2);

      final messages = <MessageModel>[];
      final reads = <ReadReceiptEvent>[];
      final typing = <TypingEvent>[];
      final subs = [
        stomp.messages.listen(messages.add),
        stomp.readReceipts.listen(reads.add),
        stomp.typing.listen(typing.add),
      ];

      server.push('/topic/conversation/c1', {
        'id': 'm1',
        'conversationId': 'c1',
        'senderId': 'u2',
        'content': 'hello',
        'type': 'text',
      });
      server.push('/topic/conversation/c1',
          {'type': 'MESSAGE_READ', 'messageId': 'm1', 'readerId': 'u2'});
      server.push('/topic/conversation/c1', 'not json');
      server.push('/topic/conversation/c1', {'type': 'SOME_FUTURE_EVENT'});
      server.push('/topic/conversation/c1/typing',
          {'userId': 'u2', 'typing': true});

      await waitUntil(() => typing.isNotEmpty);
      expect(messages.single.content, 'hello');
      expect(reads.single.readerId, 'u2');
      expect(reads.single.conversationId, 'c1');
      expect(typing.single.isTyping, isTrue);
      for (final s in subs) {
        await s.cancel();
      }
    });

    test('a conversation held twice is unsubscribed only by the last holder',
        () async {
      await connectNow();
      stomp.subscribeConversation('c1'); // chat screen
      stomp.subscribeConversation('c1'); // active call
      await waitUntil(() => server.of('SUBSCRIBE').length == 2);
      stomp.unsubscribeConversation('c1');
      await Future<void>.delayed(const Duration(milliseconds: 150));
      expect(server.of('UNSUBSCRIBE'), isEmpty);
      stomp.unsubscribeConversation('c1');
      await waitUntil(() => server.of('UNSUBSCRIBE').length == 2);
    });

    test('user queues: notifications, personal CONVERSATION_UPDATED, webrtc, '
        'meeting', () async {
      await connectNow();
      stomp.subscribeNotifications();
      await waitUntil(() => server.of('SUBSCRIBE').length == 3);
      expect(server.subscribedDestinations(), [
        '/user/queue/notifications',
        '/user/queue/webrtc',
        '/user/queue/meeting',
      ]);
      final notifs = <Map<String, dynamic>>[];
      final convs = <ConversationUpdateEvent>[];
      final rtc = <Map<String, dynamic>>[];
      final meet = <Map<String, dynamic>>[];
      final subs = [
        stomp.notifications.listen(notifs.add),
        stomp.conversationUpdates.listen(convs.add),
        stomp.webrtcSignals.listen(rtc.add),
        stomp.meetingQueue.listen(meet.add),
      ];
      server.push('/user/queue/notifications',
          {'type': 'NEW_MESSAGE', 'conversationId': 'c1'});
      server.push('/user/queue/notifications', {
        'type': 'CONVERSATION_UPDATED',
        'conversation': {'id': 'c1'}
      });
      server.push('/user/queue/webrtc', {'type': 'offer'});
      server.push('/user/queue/meeting', {'event': 'meeting.invited'});
      await waitUntil(() => meet.isNotEmpty);
      expect(notifs.single['type'], 'NEW_MESSAGE');
      expect(convs.single.personal, isTrue);
      expect(rtc.single['type'], 'offer');
      for (final s in subs) {
        await s.cancel();
      }
    });

    test('meeting topic subscribe / unsubscribe', () async {
      await connectNow();
      stomp.subscribeMeetingTopic('mt1');
      await waitUntil(() => server.of('SUBSCRIBE').isNotEmpty);
      final got = <Map<String, dynamic>>[];
      final s = stomp.meetingTopic.listen(got.add);
      server.push('/topic/meeting/mt1', {'event': 'x'});
      await waitUntil(() => got.isNotEmpty);
      stomp.unsubscribeMeetingTopic('mt1');
      await waitUntil(() => server.of('UNSUBSCRIBE').isNotEmpty);
      await s.cancel();
    });

    test('sends: chat.send (replyToId only when set), typing, read, raw',
        () async {
      await connectNow();
      stomp.sendMessage('c1', 'hi');
      stomp.sendMessage('c1', 'yo', type: 'image', replyToId: 'm0');
      stomp.sendTyping('c1', isTyping: false);
      stomp.sendRead('c1', 'm1');
      stomp.sendRawMessage(destination: '/app/raw', body: 'b');
      await waitUntil(() => server.of('SEND').length == 5);
      final sends = server.of('SEND');
      expect(sends[0].headers['destination'], '/app/chat.send');
      expect(jsonDecode(sends[0].body),
          {'conversationId': 'c1', 'content': 'hi', 'type': 'text'});
      expect(jsonDecode(sends[1].body), {
        'conversationId': 'c1',
        'content': 'yo',
        'type': 'image',
        'replyToId': 'm0',
      });
      expect(sends[2].headers['destination'], '/app/chat.typing');
      expect(jsonDecode(sends[2].body),
          {'conversationId': 'c1', 'typing': false});
      expect(jsonDecode(sends[3].body),
          {'conversationId': 'c1', 'messageId': 'm1'});
      expect(sends[4].body, 'b');
    });

    test('socket drop → auto-reconnect re-subscribes everything, then '
        'announces the reconnect', () async {
      await connectNow();
      stomp.subscribeNotifications();
      stomp.subscribeConversation('c1');
      await waitUntil(() => server.of('SUBSCRIBE', socket: 0).length == 5);

      final states = <bool>[];
      var reconnects = 0;
      final s1 = stomp.connectionChanges.listen(states.add);
      final s2 = stomp.reconnects.listen((_) => reconnects++);

      await server.dropSocket();
      await waitUntil(() => states.contains(false));
      await waitUntil(() => reconnects == 1);
      await waitUntil(() => server.of('SUBSCRIBE', socket: 1).length == 5);

      expect(server.subscribedDestinations(socket: 1).toSet(),
          server.subscribedDestinations(socket: 0).toSet());
      expect(states, [false, true]);
      expect(stomp.isConnected, isTrue);
      await s1.cancel();
      await s2.cancel();
    });

    test('ERROR frame (token revoked server-side) → next connect FORCES a '
        'refresh and uses the new token', () async {
      FlutterSecureStorage.setMockInitialValues({
        'accessToken': token,
        'refreshToken': 'rt-1',
        'sid': 'sid-1',
      });
      final fresh = _jwt(const Duration(hours: 2), sub: 'fresh');
      server.refreshBody = {'accessToken': fresh, 'refreshToken': 'rt-2'};
      await connectNow();

      server.sendError();
      await Future<void>.delayed(const Duration(milliseconds: 100));
      await server.dropSocket();
      await waitUntil(() => server.of('CONNECT').length == 2);

      expect(server.refreshBodies.single, {'sid': 'sid-1', 'refreshToken': 'rt-1'});
      expect(server.of('CONNECT').last.headers['Authorization'],
          'Bearer $fresh');
      expect(server.upgradeAuth.last, 'Bearer $fresh');
      expect(auth.forcedLogouts, 0);
    });

    test('refresh REJECTED (401) → stop reconnecting and force logout',
        () async {
      FlutterSecureStorage.setMockInitialValues({
        'accessToken': token,
        'refreshToken': 'rt-1',
        'sid': 'sid-1',
      });
      server.refreshStatus = 401;
      server.refreshBody = {'code': 'SESSION_REVOKED'};
      await connectNow();

      server.sendError();
      await Future<void>.delayed(const Duration(milliseconds: 100));
      await server.dropSocket();
      await waitUntil(() => auth.forcedLogouts == 1);

      await Future<void>.delayed(const Duration(seconds: 3));
      expect(server.socketCount, 1, reason: 'no reconnect after rejection');
      expect(stomp.isConnected, isFalse);
    });

    test('disconnect keeps desired subscriptions; reconnect() re-subscribes',
        () async {
      await connectNow();
      stomp.subscribeConversation('c1');
      await waitUntil(() => server.of('SUBSCRIBE').length == 2);
      stomp.disconnect();
      expect(stomp.isConnected, isFalse);

      await stomp.reconnect();
      await waitUntil(() => server.of('SUBSCRIBE', socket: 1).length == 2);
      expect(server.subscribedDestinations(socket: 1),
          ['/topic/conversation/c1', '/topic/conversation/c1/typing']);
    });

    test('resetSession (logout) forgets subscriptions for the next account',
        () async {
      await connectNow();
      stomp.subscribeConversation('c1');
      stomp.subscribeNotifications();
      await waitUntil(() => server.of('SUBSCRIBE').length == 5);
      stomp.resetSession();
      expect(stomp.isConnected, isFalse);

      await stomp.connect(token);
      await waitUntil(() => stomp.isConnected);
      await Future<void>.delayed(const Duration(milliseconds: 200));
      expect(server.of('SUBSCRIBE', socket: 1), isEmpty);
    });
  });

  group('no session', () {
    test('expired token + no refresh credentials → never CONNECTs, stops loop',
        () async {
      await setUpWith({'accessToken': _jwt(const Duration(hours: -1))});
      await stomp.connect('stale');
      await Future<void>.delayed(const Duration(seconds: 3));
      expect(server.of('CONNECT'), isEmpty);
      expect(server.socketCount, 0);
      expect(stomp.isConnected, isFalse);
      expect(auth.forcedLogouts, 0);
    });
  });
}
