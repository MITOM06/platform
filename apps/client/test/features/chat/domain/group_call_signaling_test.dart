import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:platform_client/core/router/app_router.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/call_transport.dart';
import 'package:platform_client/features/chat/domain/group_call_controller.dart';
import 'package:platform_client/features/chat/domain/group_call_signaling.dart';
import 'package:platform_client/features/chat/domain/group_call_state.dart';

import 'call_test_stomp.dart';

/// Routing of group-call STOMP traffic: rings, mesh signals of a call only
/// (never 1-on-1), roster / end events, and the starter's auto-join.

class _Stomp extends RecordingStomp {
  final webrtc = StreamController<Map<String, dynamic>>.broadcast();
  final events = StreamController<Map<String, dynamic>>.broadcast();
  final connects = StreamController<void>.broadcast();

  @override
  Stream<Map<String, dynamic>> get webrtcSignals => webrtc.stream;
  @override
  Stream<Map<String, dynamic>> get callEvents => events.stream;
  @override
  Stream<void> get connections => connects.stream;
}

class _Auth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
      UserModel(id: 'me', email: 'me@acme.com', displayName: 'Me'));
}

class _Api implements CallsApi {
  CallTransport transport = CallTransport.sfu;
  @override
  Future<CallConfig> getConfig() async => CallConfig(transport: transport);
  @override
  Future<CallToken> getToken(String callId) async =>
      throw UnimplementedError();
}

class _Router extends Fake implements GoRouter {
  final pushed = <String>[];
  @override
  Future<T?> push<T extends Object?>(String location, {Object? extra}) async {
    pushed.add(location);
    return null;
  }
}

class _Call extends GroupCallController {
  _Call(this.initial);
  final GroupCallState initial;
  final log = <String>[];
  Object? joinError;
  Map<String, Object?>? joined;

  @override
  GroupCallState build() => initial;

  @override
  Future<void> join({
    required String callId,
    required String conversationId,
    required bool isVideo,
    required bool aiNotetaker,
    required bool isStarter,
    CallTransport transport = CallTransport.mesh,
  }) async {
    joined = {
      'callId': callId,
      'conversationId': conversationId,
      'isVideo': isVideo,
      'aiNotetaker': aiNotetaker,
      'isStarter': isStarter,
      'transport': transport,
    };
    final e = joinError;
    if (e != null) throw e;
  }

  @override
  Future<void> onOffer(String callId, String fromId, String sdp) async =>
      log.add('offer:$callId:$fromId:$sdp');
  @override
  Future<void> onAnswer(String callId, String fromId, String sdp) async =>
      log.add('answer:$callId:$fromId:$sdp');
  @override
  Future<void> onIce(
          String callId, String fromId, Map<String, dynamic> c) async =>
      log.add('ice:$callId:$fromId:${c['candidate']}');
  @override
  Future<void> applyRoster(String callId, List<CallParticipant> roster) async =>
      log.add('roster:$callId:${roster.map((p) => p.userId).join(',')}');
  @override
  Future<void> onCallEnded(String callId) async => log.add('ended:$callId');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _Stomp stomp;
  late _Call call;
  late _Router router;
  late _Api api;
  late ProviderContainer container;

  Future<void> setUpWith(GroupCallState initial) async {
    stomp = _Stomp();
    call = _Call(initial);
    router = _Router();
    api = _Api();
    container = ProviderContainer(overrides: [
      stompServiceProvider.overrideWith(() => stomp),
      authNotifierProvider.overrideWith(_Auth.new),
      groupCallControllerProvider.overrideWith(() => call),
      appRouterProvider.overrideWithValue(router),
      callsRepositoryProvider.overrideWithValue(api),
    ]);
    await container.read(authNotifierProvider.future);
    container.read(groupCallSignalingProvider);
  }

  setUp(() => setUpWith(const GroupCallState()));
  tearDown(() => container.dispose());

  Future<void> signal(Map<String, dynamic> s) async {
    stomp.webrtc.add(s);
    await pumpEventQueue();
  }

  Future<void> event(Map<String, dynamic> e) async {
    stomp.events.add(e);
    await pumpEventQueue();
  }

  IncomingGroupCall? ringing() =>
      container.read(incomingGroupCallNotifierProvider);

  group('call-ring', () {
    test('rings with every field mapped', () async {
      await signal({
        'type': 'call-ring',
        'callId': 'g1',
        'conversationId': 'conv',
        'senderId': 'u7',
        'startedByName': 'Lan',
        'media': 'video',
        'aiNotetaker': true,
        'transport': 'sfu',
      });
      final r = ringing()!;
      expect(r.callId, 'g1');
      expect(r.conversationId, 'conv');
      expect(r.startedById, 'u7');
      expect(r.startedByName, 'Lan');
      expect(r.isVideo, isTrue);
      expect(r.aiNotetaker, isTrue);
      expect(r.transport, CallTransport.sfu);
    });

    test('defaults: voice, no notetaker, mesh, empty names', () async {
      await signal(
          {'type': 'call-ring', 'callId': 'g1', 'conversationId': 'conv'});
      final r = ringing()!;
      expect(r.isVideo, isFalse);
      expect(r.aiNotetaker, isFalse);
      expect(r.transport, CallTransport.mesh);
      expect(r.startedById, '');
    });

    test('a ring without callId or conversationId is dropped', () async {
      await signal({'type': 'call-ring', 'conversationId': 'conv'});
      await signal({'type': 'call-ring', 'callId': 'g1'});
      expect(ringing(), isNull);
    });
  });

  group('mesh signals', () {
    test('offer / answer / ice of a call reach the controller', () async {
      await signal(
          {'type': 'offer', 'callId': 'g1', 'fromId': 'a', 'sdp': 'o'});
      await signal(
          {'type': 'answer', 'callId': 'g1', 'fromId': 'a', 'sdp': 'x'});
      await signal({
        'type': 'ice',
        'callId': 'g1',
        'fromId': 'a',
        'candidate': {'candidate': 'c1'}
      });
      expect(call.log, ['offer:g1:a:o', 'answer:g1:a:x', 'ice:g1:a:c1']);
    });

    test('1-on-1 signals (no callId) are left to the 1-on-1 flow', () async {
      await signal({'type': 'offer', 'fromId': 'a', 'sdp': 'o'});
      expect(call.log, isEmpty);
    });

    test('malformed: no sender, no sdp, no candidate, unknown type',
        () async {
      await signal({'type': 'offer', 'callId': 'g1', 'sdp': 'o'});
      await signal({'type': 'offer', 'callId': 'g1', 'fromId': 'a'});
      await signal({'type': 'answer', 'callId': 'g1', 'fromId': 'a'});
      await signal({'type': 'ice', 'callId': 'g1', 'fromId': 'a'});
      await signal({'type': 'weird', 'callId': 'g1', 'fromId': 'a'});
      expect(call.log, isEmpty);
    });

    test('a candidate of the wrong shape is ignored, not fatal', () async {
      await signal({
        'type': 'ice',
        'callId': 'g1',
        'fromId': 'a',
        'candidate': 'not-a-map'
      });
      await signal(
          {'type': 'offer', 'callId': 'g1', 'fromId': 'a', 'sdp': 'o'});
      expect(call.log, ['offer:g1:a:o']); // stream still alive
    });
  });

  group('call events', () {
    test('roster parsed and applied', () async {
      await event({
        'event': 'call.roster',
        'callId': 'g1',
        'participants': [
          {'userId': 'me', 'displayName': 'Me'},
          {'userId': 'a', 'displayName': 'A', 'joinedAt': '2026-01-01T00:00:00Z'},
        ],
      });
      expect(call.log, ['roster:g1:me,a']);
    });

    test('roster without participants applies an empty list', () async {
      await event({'event': 'call.roster', 'callId': 'g1'});
      expect(call.log, ['roster:g1:']);
    });

    test('events without callId are ignored', () async {
      await event({'event': 'call.ended'});
      expect(call.log, isEmpty);
    });

    test('call.ended ends it and dismisses that ring only', () async {
      await signal(
          {'type': 'call-ring', 'callId': 'g1', 'conversationId': 'conv'});
      await event({'event': 'call.ended', 'callId': 'other'});
      expect(ringing()?.callId, 'g1');
      await event({'event': 'call.ended', 'callId': 'g1'});
      expect(ringing(), isNull);
      expect(call.log, ['ended:other', 'ended:g1']);
    });
  });

  group('call.started (starter auto-join)', () {
    Map<String, dynamic> started({
      String startedBy = 'me',
      String? kind,
    }) =>
        {
          'event': 'call.started',
          'callId': 'g1',
          'conversationId': 'conv',
          'startedBy': startedBy,
          'media': 'video',
          'aiNotetaker': true,
          'transport': 'sfu',
          if (kind != null) 'kind': kind,
        };

    test('our own call: joined as starter and the call screen opens',
        () async {
      await event(started());
      expect(call.joined, {
        'callId': 'g1',
        'conversationId': 'conv',
        'isVideo': true,
        'aiNotetaker': true,
        'isStarter': true,
        'transport': CallTransport.sfu,
      });
      expect(router.pushed, ['/group-call']);
    });

    test('someone else started it: no auto-join', () async {
      await event(started(startedBy: 'u9'));
      expect(call.joined, isNull);
      expect(router.pushed, isEmpty);
    });

    test('a LiveKit 1-on-1 is never joined as a group call', () async {
      await event(started(kind: 'direct'));
      expect(call.joined, isNull);
    });

    test('already in a group call: no second join', () async {
      container.dispose();
      await setUpWith(const GroupCallState(callId: 'busy', joined: true));
      await event(started());
      expect(call.joined, isNull);
    });

    test('join fails: no call screen', () async {
      call.joinError = Exception('media');
      await event(started());
      expect(call.joined, isNotNull);
      expect(router.pushed, isEmpty);
    });
  });

  test('every (re)connect refreshes the call transport', () async {
    final cache = container.read(callTransportProvider);
    expect(cache.current, CallTransport.mesh);
    stomp.connects.add(null);
    await pumpEventQueue();
    expect(cache.current, CallTransport.sfu);
  });

  test('disposed: stops listening', () async {
    container.dispose();
    stomp.webrtc.add({'type': 'offer', 'callId': 'g', 'fromId': 'a', 'sdp': 's'});
    await pumpEventQueue();
    expect(call.log, isEmpty);
    // Re-create so tearDown has a live container to dispose.
    await setUpWith(const GroupCallState());
  });
}
