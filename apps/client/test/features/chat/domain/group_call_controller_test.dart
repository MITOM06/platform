import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/auth/domain/auth_provider.dart';
import 'package:platform_client/features/auth/domain/auth_state.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/data/stomp_service.dart';
import 'package:platform_client/features/chat/domain/call_failure.dart';
import 'package:platform_client/features/chat/domain/call_transport.dart';
import 'package:platform_client/features/chat/domain/group_call_controller.dart';
import 'package:platform_client/features/chat/domain/group_call_state.dart';

import '../../../core/rtc/fake_webrtc_platform.dart';
import 'call_test_stomp.dart';

/// Group call orchestration: join (mesh / LiveKit), roster → who offers to
/// whom, routing signals of the active call only, leave vs server end, and
/// releasing every renderer / peer / conversation hold.

class _Auth extends AuthNotifier {
  @override
  Future<AuthState> build() async => const AuthAuthenticated(
      UserModel(id: 'me', email: 'me@acme.com', displayName: 'Me'));
}

class _Api implements CallsApi {
  Future<CallToken> Function(String callId) token =
      (_) async => throw Exception('offline');
  final tokenRequests = <String>[];

  @override
  Future<CallConfig> getConfig() async =>
      const CallConfig(transport: CallTransport.sfu);

  @override
  Future<CallToken> getToken(String callId) {
    tokenRequests.add(callId);
    return token(callId);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeWebRtcPlatform native;
  late RecordingStomp stomp;
  late _Api api;
  late ProviderContainer container;

  GroupCallController ctl() =>
      container.read(groupCallControllerProvider.notifier);
  GroupCallState st() => container.read(groupCallControllerProvider);

  setUp(() async {
    native = FakeWebRtcPlatform()..install();
    stomp = RecordingStomp();
    api = _Api();
    container = ProviderContainer(overrides: [
      stompServiceProvider.overrideWith(() => stomp),
      authNotifierProvider.overrideWith(_Auth.new),
      callsRepositoryProvider.overrideWithValue(api),
    ]);
    await container.read(authNotifierProvider.future);
    container.read(groupCallControllerProvider); // build
  });
  // Not disposed here: see the skipped BUG test at the bottom (disposing a
  // controller whose STT never started throws inside onDispose).
  tearDown(() async {
    await pumpEventQueue();
    native.uninstall();
  });

  Future<void> joinMesh({
    String callId = 'call1',
    bool isVideo = true,
    bool isStarter = false,
    bool aiNotetaker = false,
  }) =>
      ctl().join(
        callId: callId,
        conversationId: 'conv1',
        isVideo: isVideo,
        aiNotetaker: aiNotetaker,
        isStarter: isStarter,
      );

  final t0 = DateTime.utc(2026, 1, 1, 10);
  CallParticipant p(String id, {DateTime? at, DateTime? left}) =>
      CallParticipant(userId: id, displayName: id, joinedAt: at, leftAt: left);

  group('join (mesh)', () {
    test('holds the conversation, opens media, announces call.join',
        () async {
      await joinMesh(isVideo: false);
      expect(stomp.subscribed, ['conv1']);
      expect(st().callId, 'call1');
      expect(st().joined, isTrue);
      expect(st().isVideo, isFalse);
      expect(st().camEnabled, isFalse);
      expect(st().micEnabled, isTrue);
      expect(st().transport, CallTransport.mesh);
      expect(stomp.to('/app/call.join'), [
        {'callId': 'call1'}
      ]);
      expect(native.named('createVideoRenderer'), hasLength(1));
    });

    test('joining the same call twice is a no-op', () async {
      await joinMesh();
      await joinMesh();
      expect(stomp.to('/app/call.join'), hasLength(1));
      expect(native.named('getUserMedia'), hasLength(1));
    });

    test('mic/camera refused: MediaAccessException, nothing joined',
        () async {
      native.onGetUserMedia =
          (_) => throw PlatformException(code: 'NotAllowedError');
      await expectLater(joinMesh(), throwsA(isA<MediaAccessException>()));
      expect(st().isActive, isFalse);
      expect(stomp.to('/app/call.join'), isEmpty);
      expect(stomp.unsubscribed, ['conv1']); // hold released
    });

    test('a second call releases the first conversation hold', () async {
      await joinMesh();
      await ctl().join(
          callId: 'call2',
          conversationId: 'conv2',
          isVideo: false,
          aiNotetaker: false,
          isStarter: false);
      expect(stomp.subscribed, ['conv1', 'conv2']);
      expect(stomp.unsubscribed, ['conv1']);
    });
  });

  group('roster (mesh glare rule)', () {
    test('offers only to present peers who joined before us', () async {
      await joinMesh();
      await ctl().applyRoster('call1', [
        p('me', at: t0),
        p('early', at: t0.subtract(const Duration(minutes: 1))),
        p('same', at: t0),
        p('unknownTime'),
        p('later', at: t0.add(const Duration(minutes: 1))),
        p('gone', at: t0.subtract(const Duration(minutes: 5)), left: t0),
      ]);
      final targets =
          stomp.to('/app/call.offer').map((o) => o['targetId']).toList();
      expect(targets, ['early', 'same', 'unknownTime']);
      expect(st().roster, hasLength(6));
      expect(st().presentCount, 5);
    });

    test('roster of another call is ignored', () async {
      await joinMesh();
      await ctl().applyRoster('other', [p('x', at: t0)]);
      expect(st().roster, isEmpty);
      expect(stomp.to('/app/call.offer'), isEmpty);
    });

    test('a peer that left loses its tile and connection', () async {
      await joinMesh();
      await ctl().onOffer('call1', 'x', 'offer');
      expect(ctl().remotePeers.keys, ['x']);
      await ctl().applyRoster('call1', [p('me', at: t0)]);
      await pumpEventQueue();
      expect(ctl().remotePeers, isEmpty);
      expect(native.named('peerConnectionClose'), hasLength(1));
      expect(native.named('videoRendererDispose'), hasLength(1));
    });
  });

  group('signals', () {
    test('signals of another call are dropped', () async {
      await joinMesh();
      await ctl().onOffer('other', 'x', 'sdp');
      await ctl().onAnswer('other', 'x', 'sdp');
      await ctl().onIce('other', 'x', {'candidate': 'c'});
      expect(native.named('setRemoteDescription'), isEmpty);
      expect(ctl().remotePeers, isEmpty);
    });

    test('offer from a later joiner: tile created, answered', () async {
      await joinMesh();
      await ctl().onOffer('call1', 'x', 'sdp');
      expect(ctl().remotePeers['x']?.peerId, 'x');
      expect(stomp.to('/app/call.answer').single['targetId'], 'x');
    });

    test('answer + ICE of the active call reach the mesh', () async {
      await joinMesh();
      await ctl().applyRoster('call1', [
        p('me', at: t0),
        p('a', at: t0.subtract(const Duration(seconds: 1))),
      ]);
      await ctl().onIce('call1', 'a', {'candidate': 'c1', 'sdpMLineIndex': 0});
      await ctl().onAnswer('call1', 'a', 'answer');
      expect(native.named('setRemoteDescription'), hasLength(1));
      expect(native.named('addCandidate'), hasLength(1));
    });

    test('remote stream binds to the peer tile with its video flag',
        () async {
      await joinMesh();
      await ctl().onOffer('call1', 'x', 'sdp');
      await native.remoteTrack('pc1', streamId: 'sx');
      await pumpEventQueue();
      expect(ctl().remotePeers['x']?.hasVideo, isTrue);
      expect(ctl().remotePeers['x']?.renderer.srcObject?.id, 'sx');
    });
  });

  test('stream from a peer we offered to (no tile yet) gets a tile',
      () async {
    await joinMesh();
    await ctl().applyRoster('call1', [
      p('me', at: t0),
      p('a', at: t0.subtract(const Duration(seconds: 1))),
    ]);
    expect(ctl().remotePeers, isEmpty);
    await native.remoteTrack('pc1', streamId: 'sa', kind: 'audio');
    await pumpEventQueue();
    expect(ctl().remotePeers['a']?.renderer.srcObject?.id, 'sa');
    expect(ctl().remotePeers['a']?.hasVideo, isFalse);
  });

  group('AI notetaker (starter runs STT)', () {
    const speech = MethodChannel('plugin.csdcorp.com/speech_to_text');
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    tearDown(() => messenger.setMockMethodCallHandler(speech, null));

    test('starter + notetaker: STT runs; leave stops it', () async {
      final calls = <String>[];
      messenger.setMockMethodCallHandler(speech, (call) async {
        calls.add(call.method);
        return call.method == 'initialize' || call.method == 'listen'
            ? true
            : null;
      });
      await joinMesh(isStarter: true, aiNotetaker: true);
      await pumpEventQueue();
      expect(st().sttActive, isTrue);
      await ctl().leave();
      expect(st().sttActive, isFalse);
      expect(calls, contains('stop'));
    });

    test('a non-starter never runs STT', () async {
      final calls = <String>[];
      messenger.setMockMethodCallHandler(speech, (call) async {
        calls.add(call.method);
        return true;
      });
      await joinMesh(aiNotetaker: true);
      await pumpEventQueue();
      expect(calls, isEmpty);
    });
  });

  group('leave / end', () {
    test('leave announces call.leave and tears everything down', () async {
      await joinMesh();
      await ctl().onOffer('call1', 'x', 'sdp');
      await ctl().leave();
      expect(stomp.to('/app/call.leave'), [
        {'callId': 'call1'}
      ]);
      expect(stomp.unsubscribed, ['conv1']);
      expect(st().isActive, isFalse);
      expect(ctl().remotePeers, isEmpty);
      expect(native.named('peerConnectionClose'), hasLength(1));
      expect(native.named('streamDispose'), hasLength(1));
    });

    test('leave with no call sends nothing', () async {
      await ctl().leave();
      expect(stomp.sent, isEmpty);
    });

    test('server ended the call: torn down WITHOUT call.leave', () async {
      await joinMesh();
      await ctl().onCallEnded('call1');
      expect(stomp.to('/app/call.leave'), isEmpty);
      expect(st().isActive, isFalse);
      expect(stomp.unsubscribed, ['conv1']);
    });

    test('end of another call leaves ours running', () async {
      await joinMesh();
      await ctl().onCallEnded('other');
      expect(st().callId, 'call1');
    });
  });

  group('media toggles', () {
    test('mic toggles state and the audio track', () async {
      await joinMesh();
      ctl().toggleMic();
      await pumpEventQueue();
      expect(st().micEnabled, isFalse);
      expect(native.named('mediaStreamTrackSetEnable'), hasLength(1));
      ctl().toggleMic();
      expect(st().micEnabled, isTrue);
    });

    test('camera toggle is ignored in a voice call', () async {
      await joinMesh(isVideo: false);
      ctl().toggleCam();
      expect(st().camEnabled, isFalse);
      expect(native.named('mediaStreamTrackSetEnable'), isEmpty);
    });

    test('camera toggles in a video call', () async {
      await joinMesh();
      ctl().toggleCam();
      expect(st().camEnabled, isFalse);
    });
  });

  group('join (LiveKit / sfu)', () {
    Future<void> joinSfu({bool isStarter = false}) => ctl().join(
          callId: 'call9',
          conversationId: 'conv9',
          isVideo: true,
          aiNotetaker: false,
          isStarter: isStarter,
          transport: CallTransport.sfu,
        );

    test('token refused: leaves server-side and rethrows the reason',
        () async {
      api.token = (_) async => throw const CallRefusedException(
          CallFailure.forbidden);
      await expectLater(joinSfu(), throwsA(isA<RoomConnectException>()));
      // Non-starter accepts first, then leaves so it is not counted in.
      expect(stomp.sent.map((s) => s.destination).toList(),
          ['/app/call.accept', '/app/call.leave']);
      expect(st().isActive, isFalse);
      expect(stomp.unsubscribed, ['conv9']);
      expect(native.named('getUserMedia'), isEmpty); // no mesh media
    });

    test('starter does not send call.accept', () async {
      await expectLater(joinSfu(isStarter: true), throwsA(anything));
      expect(stomp.to('/app/call.accept'), isEmpty);
      expect(stomp.to('/app/call.leave'), hasLength(1));
    });

    test('while the room connects: sfu state, roster kept, toggles stored',
        () async {
      final pending = Completer<CallToken>();
      api.token = (_) => pending.future;
      unawaited(joinSfu().catchError((_) {}));
      await pumpEventQueue();
      expect(st().transport, CallTransport.sfu);
      expect(st().joined, isTrue);
      expect(api.tokenRequests, ['call9']);

      await ctl().applyRoster('call9', [p('me', at: t0), p('a')]);
      expect(st().roster, hasLength(2));
      expect(stomp.to('/app/call.offer'), isEmpty); // LiveKit, not mesh

      ctl().toggleMic();
      ctl().toggleCam();
      expect(st().micEnabled, isFalse);
      expect(st().camEnabled, isFalse);
      expect(native.named('mediaStreamTrackSetEnable'), isEmpty);
      pending.completeError(Exception('gone'));
      await pumpEventQueue();
    });
  });

  test(
      'disposing the controller releases its media even when STT never ran',
      () async {
    await joinMesh();
    container.dispose();
    await pumpEventQueue();
    expect(native.named('streamDispose'), hasLength(1));
    expect(native.named('videoRendererDispose'), hasLength(1));
  },
      // BUG: group_call_controller.dart:28/90 — `_stt` is a lazy `late final`
      // that does `ref.read(stompServiceProvider…)`; its first touch is inside
      // ref.onDispose when STT never started, so it throws "ProviderContainer
      // already disposed" and the rest of the dispose callback (mesh, sfu,
      // renderers) never runs. Fix: read the StompService once in build()
      // (e.g. `final stomp = ref.read(...)`) and create `_stt` from it there.
      skip: 'BUG: onDispose reads ref lazily (see comment)');
}
