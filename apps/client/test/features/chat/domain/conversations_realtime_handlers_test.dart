// conversations_realtime_handlers.dart: routing of raw 1-on-1 WebRTC signals
// (ring / busy / renegotiate / end / answered-elsewhere), sender-name
// sanitizing and closing a conversation the user was removed from.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/router/app_router.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/call_sounds.dart';
import 'package:platform_client/features/chat/domain/call_transport.dart';
import 'package:platform_client/features/chat/domain/conversations_realtime_handlers.dart';
import 'package:platform_client/features/chat/domain/group_call_controller.dart';
import 'package:platform_client/features/chat/domain/group_call_signaling.dart';
import 'package:platform_client/features/chat/domain/sfu_call_signals.dart';
import 'package:platform_client/features/chat/domain/group_call_state.dart';
import 'package:platform_client/features/chat/domain/incoming_call.dart';
import 'package:platform_client/features/chat/domain/sfu_call_service.dart';
import 'package:platform_client/features/chat/domain/webrtc_service.dart';
import 'package:platform_client/features/home/domain/home_providers.dart';
import 'package:platform_client/l10n/app_localizations.dart';

import 'call_test_stomp.dart';

class _Port implements CallSignalPort {
  @override
  void send(String destination, Map<String, dynamic> body) {}
  @override
  void holdConversation(String id) {}
  @override
  void releaseConversation(String id) {}
  @override
  Stream<Map<String, dynamic>> get callEvents => const Stream.empty();
}

class _Api implements CallsApi {
  @override
  Future<CallConfig> getConfig() async =>
      const CallConfig(transport: CallTransport.mesh);
  @override
  Future<CallToken> getToken(String callId) async =>
      const CallToken(url: '', token: '');
}

class _GroupCall extends GroupCallController {
  _GroupCall(this._initial);
  final GroupCallState _initial;
  @override
  GroupCallState build() => _initial;
}

class _SilentPlayer implements TonePlayer {
  @override
  Future<void> loop(CallTone tone, {bool speaker = false}) async {}
  @override
  Future<void> stop() async {}
}

const _offerAudio = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111';
const _offerVideo = 'v=0\r\nm=audio 9\r\nm=video 9';

void main() {
  late RecordingStomp stomp;
  late ProviderContainer c;
  late GoRouter router;

  ProviderContainer make({GroupCallState group = const GroupCallState()}) {
    stomp = RecordingStomp();
    router = GoRouter(initialLocation: '/chat/c1', routes: [
      GoRoute(path: '/', builder: (_, __) => const SizedBox()),
      GoRoute(path: '/chat/:id', builder: (_, __) => const SizedBox()),
    ]);
    final sfu = SfuCallService(
      port: _Port(),
      api: _Api(),
      transport: CallTransportCache(),
      sessionFactory: () => throw UnimplementedError(),
      probeMedia: (_) async => true,
    );
    final container = ProviderContainer(overrides: [
      stompServiceProvider.overrideWith(() => stomp),
      sfuCallServiceProvider.overrideWithValue(sfu),
      groupCallControllerProvider.overrideWith(() => _GroupCall(group)),
      callSoundsProvider
          .overrideWithValue(CallSounds(_SilentPlayer(), vibrate: () {})),
      appRouterProvider.overrideWith((ref) => router),
    ]);
    addTearDown(() {
      container.dispose();
      sfu.dispose();
      router.dispose();
    });
    return container;
  }

  /// Runs the handler with a real Riverpod [Ref].
  void signal(ProviderContainer c, Map<String, dynamic> s) {
    final p = Provider<void Function()>(
        (ref) => () => handleWebRtcSignal(ref, s, null));
    c.read(p)();
  }

  group('handleWebRtcSignal', () {
    setUp(() => c = make());

    test('an offer from a new caller rings with its media kind', () {
      signal(c, {
        'type': 'offer',
        'senderId': 'bob',
        'conversationId': 'c1',
        'sdp': _offerVideo,
        'targetId': 'me',
      });
      final call = c.read(incomingCallProvider);
      expect(call?.senderId, 'bob');
      expect(call?.conversationId, 'c1');
      expect(call?.sdp, _offerVideo);
      expect(call?.isVideo, isTrue);
      expect(stomp.sent, isEmpty);
    });

    test('the same caller re-sending its offer keeps one prompt', () {
      final offer = {
        'type': 'offer',
        'senderId': 'bob',
        'conversationId': 'c1',
        'sdp': _offerAudio,
      };
      signal(c, offer);
      final first = c.read(incomingCallProvider);
      signal(c, offer);
      expect(identical(c.read(incomingCallProvider), first), isTrue);
      expect(first?.isVideo, isFalse);
      expect(stomp.sent, isEmpty);
    });

    test('a second caller while ringing gets "busy"', () {
      signal(c, {
        'type': 'offer',
        'senderId': 'bob',
        'conversationId': 'c1',
        'sdp': _offerAudio,
      });
      signal(c, {
        'type': 'offer',
        'senderId': 'eve',
        'conversationId': 'c2',
        'sdp': _offerAudio,
      });
      expect(c.read(incomingCallProvider)?.senderId, 'bob');
      final ends = stomp.to('/app/call.end');
      expect(ends.single['targetId'], 'eve');
      expect(ends.single['conversationId'], 'c2');
      expect(ends.single['reason'], 'busy');
    });

    test('an offer missing sender / conversation / sdp is ignored', () {
      for (final s in [
        {'type': 'offer', 'conversationId': 'c1', 'sdp': _offerAudio},
        {'type': 'offer', 'senderId': 'bob', 'sdp': _offerAudio},
        {'type': 'offer', 'senderId': 'bob', 'conversationId': 'c1'},
      ]) {
        signal(c, s);
      }
      expect(c.read(incomingCallProvider), isNull);
      expect(stomp.sent, isEmpty);
    });

    test('group-call signals (call-ring / callId) are left alone', () {
      signal(c, {'type': 'call-ring', 'senderId': 'bob'});
      signal(c, {
        'type': 'offer',
        'senderId': 'bob',
        'conversationId': 'c1',
        'sdp': _offerAudio,
        'callId': 'g1',
      });
      expect(c.read(incomingCallProvider), isNull);
    });

    test('end from the ringing caller clears the prompt; others do not', () {
      signal(c, {
        'type': 'offer',
        'senderId': 'bob',
        'conversationId': 'c1',
        'sdp': _offerAudio,
      });
      signal(c, {'type': 'end', 'senderId': 'eve', 'reason': 'hangup'});
      expect(c.read(incomingCallProvider), isNotNull);
      signal(c, {'type': 'end', 'senderId': 'bob', 'reason': 'hangup'});
      expect(c.read(incomingCallProvider), isNull);
    });

    test('answered-elsewhere clears only the matching call', () {
      signal(c, {
        'type': 'offer',
        'senderId': 'bob',
        'conversationId': 'c1',
        'sdp': _offerAudio,
      });
      signal(c, {
        'type': 'answered-elsewhere',
        'senderId': 'bob',
        'conversationId': 'other'
      });
      expect(c.read(incomingCallProvider), isNotNull);
      signal(c, {
        'type': 'answered-elsewhere',
        'senderId': 'bob',
        'conversationId': 'c1'
      });
      expect(c.read(incomingCallProvider), isNull);
    });

    test('answer / ice / state without a call are harmless no-ops', () {
      signal(c, {'type': 'answer'});
      signal(c, {'type': 'answer', 'sdp': 'v=0'});
      signal(c, {'type': 'ice'});
      signal(c, {
        'type': 'ice',
        'senderId': 'bob',
        'candidate': {'candidate': 'x', 'sdpMid': '0', 'sdpMLineIndex': 0},
      });
      signal(c, {'type': 'state', 'senderId': 'bob', 'camera': true});
      signal(c, {'type': 'unknown-type'});
      expect(c.read(incomingCallProvider), isNull);
      expect(stomp.sent, isEmpty);
    });

    test('call-blocked tears down without throwing (no context mounted)', () {
      signal(c, {'type': 'call-blocked', 'senderId': 'bob'});
      expect(c.read(webRtcServiceProvider).isActive, isFalse);
    });

    test('a malformed signal is swallowed', () {
      expect(() => signal(c, {'type': 42}), returnsNormally);
      expect(
          () => signal(c, {
                'type': 'offer',
                'senderId': 1,
                'conversationId': 'c1',
                'sdp': 'x'
              }),
          returnsNormally);
      expect(c.read(incomingCallProvider), isNull);
    });
  });

  test('an offer while in a group call replies busy', () {
    final c = make(group: const GroupCallState(callId: 'g1'));
    signal(c, {
      'type': 'offer',
      'senderId': 'bob',
      'conversationId': 'c1',
      'sdp': _offerAudio,
    });
    expect(c.read(incomingCallProvider), isNull);
    expect(stomp.to('/app/call.end').single['reason'], 'busy');
  });

  group('displayableSenderName / looksLikeRawId', () {
    test('keeps a real name, trimmed', () {
      expect(displayableSenderName('  Ann  ', 'u1'), 'Ann');
    });

    test('drops empty, system, the id itself and raw ids', () {
      expect(displayableSenderName(null, 'u1'), isNull);
      expect(displayableSenderName('  ', 'u1'), isNull);
      expect(displayableSenderName('system', 'u1'), isNull);
      expect(displayableSenderName('u1', 'u1'), isNull);
      expect(displayableSenderName('64b7f0c2a1b2c3d4e5f60718', null), isNull);
      expect(displayableSenderName('extbot:abc', null), isNull);
      expect(displayableSenderName('ai-bot-1', null), isNull);
    });

    test('raw id shapes', () {
      expect(looksLikeRawId('64B7F0C2A1B2C3D4E5F60718'), isTrue);
      expect(looksLikeRawId('64b7f0c2a1b2c3d4e5f6071'), isFalse); // 23 chars
      expect(looksLikeRawId('Ann'), isFalse);
    });
  });

  testWidgets('notificationBodyText never leaks raw content', (tester) async {
    late BuildContext ctx;
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Builder(builder: (b) {
        ctx = b;
        return const SizedBox();
      }),
    ));
    final l = AppLocalizations.of(ctx);
    String body({
      bool mention = false,
      String? content,
      String? type,
      String? senderId,
      String? actor,
    }) =>
        notificationBodyText(ctx,
            name: 'Ann',
            isMention: mention,
            content: content,
            messageType: type,
            senderId: senderId,
            actorName: actor);

    expect(body(mention: true, content: 'secret'),
        l.mentionNotificationBody('Ann'));
    expect(body(type: 'image', content: '/api/uploads/x'),
        'Ann: [${l.attachPhoto}]');
    expect(body(type: 'video'), 'Ann: [${l.attachVideo}]');
    expect(body(type: 'file'), 'Ann: [${l.attachFile}]');
    expect(body(), l.newNotificationBody('Ann'));
    expect(body(content: ''), l.newNotificationBody('Ann'));
    expect(body(content: 'hello'), 'Ann: hello');

    final sys = body(content: 'system.nickname.changed:u2:Bobby');
    expect(sys, isNot(contains('system.')));
    expect(sys, isNot(startsWith('Ann: ')));
    final withActor = body(
        content: 'system.nickname.changed:u2:Bobby',
        senderId: 'u9',
        actor: 'Carl');
    expect(withActor, isNot(contains('system.')));
    expect(withActor, isNot(contains('u9')));
  });

  group('leaveRemovedConversation', () {
    void leave(ProviderContainer c, String id) {
      final p = Provider<void Function()>(
          (ref) => () => leaveRemovedConversation(ref, id));
      c.read(p)();
    }

    test('clears the selected pane and navigates home when it is open', () {
      final c = make();
      c.read(selectedConversationIdProvider.notifier).state = 'c1';
      leave(c, 'c1');
      expect(c.read(selectedConversationIdProvider), isNull);
      expect(router.routeInformationProvider.value.uri.path, '/');
    });

    test('another conversation: selection and route are kept', () {
      final c = make();
      c.read(selectedConversationIdProvider.notifier).state = 'c1';
      leave(c, 'c2');
      expect(c.read(selectedConversationIdProvider), 'c1');
      expect(router.routeInformationProvider.value.uri.path, '/chat/c1');
    });
  });

  group('handleSfuCallSignal', () {
    bool sfu(ProviderContainer c, Map<String, dynamic> s) {
      final p = Provider<bool Function()>(
          (ref) => () => handleSfuCallSignal(ref, s));
      return c.read(p)();
    }

    const ring = <String, dynamic>{
      'type': 'call-ring',
      'kind': 'direct',
      'transport': 'sfu',
      'callId': 'k1',
      'conversationId': 'c1',
      'senderId': 'bob',
      'media': 'video',
    };

    test('a LiveKit 1-on-1 ring shows the prompt with the call id', () {
      final c = make();
      expect(sfu(c, ring), isTrue);
      final call = c.read(incomingCallProvider);
      expect(call?.callId, 'k1');
      expect(call?.senderId, 'bob');
      expect(call?.isVideo, isTrue);
      expect(call?.transport, CallTransport.sfu);
    });

    test('a mesh "direct" ring is consumed but does not ring', () {
      final c = make();
      expect(sfu(c, {...ring, 'transport': 'mesh'}), isTrue);
      expect(c.read(incomingCallProvider), isNull);
    });

    test('the same ring twice is ignored; a second call replies busy', () {
      final c = make();
      sfu(c, ring);
      sfu(c, ring);
      expect(stomp.sent, isEmpty);
      sfu(c, {...ring, 'callId': 'k2', 'senderId': 'eve'});
      final declines = stomp.to('/app/call.decline');
      expect(declines.single, {'callId': 'k2', 'reason': 'busy'});
      expect(c.read(incomingCallProvider)?.callId, 'k1');
    });

    test('ring while in a group call replies busy', () {
      final c = make(group: const GroupCallState(callId: 'g'));
      sfu(c, ring);
      expect(c.read(incomingCallProvider), isNull);
      expect(stomp.to('/app/call.decline').single['callId'], 'k1');
    });

    test('call-ring-cancel clears the matching 1-on-1 and group prompts', () {
      final c = make();
      sfu(c, ring);
      c.read(incomingGroupCallNotifierProvider.notifier).set(
          const IncomingGroupCall(
              callId: 'k1',
              conversationId: 'c9',
              startedById: 'x',
              startedByName: 'X',
              isVideo: false,
              aiNotetaker: false));
      expect(sfu(c, {'type': 'call-ring-cancel', 'callId': 'other'}), isTrue);
      expect(c.read(incomingCallProvider), isNotNull);
      expect(c.read(incomingGroupCallNotifierProvider), isNotNull);
      sfu(c, {'type': 'call-ring-cancel', 'callId': 'k1'});
      expect(c.read(incomingCallProvider), isNull);
      expect(c.read(incomingGroupCallNotifierProvider), isNull);
    });

    test('declined / merged / accepted are consumed; others are not', () {
      final c = make();
      for (final t in ['call-declined', 'call-merged', 'call-accepted']) {
        expect(sfu(c, {'type': t, 'callId': 'k1'}), isTrue, reason: t);
      }
      expect(sfu(c, {'type': 'offer'}), isFalse);
      expect(sfu(c, {'type': 'call-ring', 'kind': 'group'}), isFalse);
    });
  });
}
