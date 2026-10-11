import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/domain/call_failure.dart';
import 'package:platform_client/features/chat/domain/call_network.dart';
import 'package:platform_client/features/chat/domain/call_rules.dart';
import 'package:platform_client/features/chat/domain/call_transport.dart';
import 'package:platform_client/features/chat/domain/direct_call_engine.dart';
import 'package:platform_client/features/chat/domain/sfu_call_service.dart';

/// QC 2026-10-11 fixes of the LiveKit 1-on-1 engine: media choices made while
/// joining, merges, `call-accepted`, the rejoin beat, the connect deadline,
/// the token refusals and closing the call screen.

class _FakeStream implements MediaStream {
  @override
  List<MediaStreamTrack> getVideoTracks() => [];
  @override
  dynamic noSuchMethod(Invocation i) => null;
}

class _Port implements CallSignalPort {
  final sent = <(String, Map<String, dynamic>)>[];
  final held = <String>[];
  final events = StreamController<Map<String, dynamic>>.broadcast();
  @override
  void send(String destination, Map<String, dynamic> body) =>
      sent.add((destination, body));
  @override
  void holdConversation(String id) => held.add(id);
  @override
  void releaseConversation(String id) => held.remove(id);
  @override
  Stream<Map<String, dynamic>> get callEvents => events.stream;
  List<Map<String, dynamic>> to(String dest) =>
      sent.where((s) => s.$1 == dest).map((s) => s.$2).toList();
}

class _Api implements CallsApi {
  Object? tokenError;
  @override
  Future<CallConfig> getConfig() async =>
      const CallConfig(transport: CallTransport.sfu);

  @override
  Future<CallToken> getToken(String callId) async {
    if (tokenError != null) throw tokenError!;
    return const CallToken(url: 'wss://rtc', token: 'tok');
  }
}

/// A room whose connect can be held open, publishing like LiveKit does: the
/// mic always, the camera when asked — whatever was toggled meanwhile.
class _Session implements RtcSession {
  _Session(this.gate);
  final Completer<void>? gate;

  @override
  void Function(MediaStream stream)? onLocalStream;
  @override
  void Function(List<RtcPeer> peers)? onPeersChanged;
  @override
  void Function(bool reconnecting)? onReconnecting;
  @override
  void Function(bool poor)? onLocalPoorConnection;
  @override
  void Function(RtcEnd reason)? onDisconnected;
  final Map<String, RtcPeer> _peers = {};
  bool? connectVideo;
  bool mic = false;
  bool camera = false;
  bool disconnected = false;

  @override
  Future<void> connect(String url, String token, {required bool video}) async {
    connectVideo = video;
    if (gate != null) await gate!.future;
    mic = true;
    camera = video;
  }

  void join(String id) {
    _peers[id] = RtcPeer(identity: id, name: id, stream: _FakeStream());
    onPeersChanged?.call(peers);
  }

  @override
  RtcPeer? peer(String identity) => _peers[identity];
  @override
  List<RtcPeer> get peers => _peers.values.toList();
  @override
  MediaStream? get localStream => null;
  @override
  Future<void> setMic(bool on) async => mic = on;
  @override
  Future<void> setCamera(bool on) async => camera = on;
  @override
  Future<void> switchCamera() async {}
  @override
  Future<void> setSpeaker(bool on) async {}
  @override
  Future<void> disconnect() async => disconnected = true;
}

DioException _refused(int status, String code) {
  final req = RequestOptions(path: '/api/calls/c1/token');
  return DioException(
    requestOptions: req,
    type: DioExceptionType.badResponse,
    response: Response(
      requestOptions: req,
      statusCode: status,
      data: {'error': 'x', 'code': code, 'statusCode': status},
    ),
  );
}

void main() {
  late _Port port;
  late _Api api;
  late List<_Session> sessions;
  late SfuCallService call;
  late List<(CallEndReason, bool, CallFailure?)> notices;
  late int answered;
  Completer<void>? nextGate;

  Future<void> flush() => Future<void>.delayed(Duration.zero);
  Map<String, dynamic> started({String callId = 'c1'}) => {
        'event': 'call.started',
        'callId': callId,
        'conversationId': 'conv',
        'transport': 'sfu',
        'kind': 'direct',
      };

  setUp(() {
    port = _Port();
    api = _Api();
    sessions = [];
    notices = [];
    answered = 0;
    nextGate = null;
    call = SfuCallService(
      port: port,
      api: api,
      transport: CallTransportCache(),
      sessionFactory: () {
        final s = _Session(nextGate);
        nextGate = null;
        sessions.add(s);
        return s;
      },
      probeMedia: (_) async => true,
      peerGrace: const Duration(seconds: 5),
      reconnectBlip: const Duration(milliseconds: 10),
      pendingStartDeadline: const Duration(milliseconds: 30),
      connectTimeout: const Duration(milliseconds: 40),
      rejoinEvery: const Duration(milliseconds: 10),
      startTimeout: const Duration(milliseconds: 40),
    );
    call
      ..onEndNotice = ((r, byPeer) => notices.add((r, byPeer, call.failure)))
      ..onAnswered = (() => answered++);
  });

  tearDown(() => call.dispose());

  Future<_Session> connected() async {
    await call.startOutgoing(
        targetId: 'bob', conversationId: 'conv', isVideo: false);
    port.events.add(started());
    await flush();
    sessions.single.join('bob');
    return sessions.single;
  }

  group('mute / camera chosen while joining (F3)', () {
    test('a mute and a camera-off tapped while the room connects stand',
        () async {
      nextGate = Completer<void>();
      final gate = nextGate!;
      call.prepareIncoming(
          targetId: 'alice', conversationId: 'conv', callId: 'c1', isVideo: true);
      final answering = call.answer();
      await flush();
      await flush();
      expect(sessions, hasLength(1)); // connecting
      await call.setMicOn(false);
      await call.setCameraOn(false);
      gate.complete();
      await answering;
      final s = sessions.single;
      expect(s.mic, isFalse);
      expect(s.camera, isFalse);
    });

    test('a camera turned off before the room is joined is never published',
        () async {
      call.prepareIncoming(
          targetId: 'alice', conversationId: 'conv', callId: 'c1', isVideo: true);
      await call.setCameraOn(false);
      await call.answer();
      expect(sessions.single.connectVideo, isFalse);
      expect(sessions.single.camera, isFalse);
    });
  });

  test('a merge into their voice call leaves no video layout behind (F4)',
      () async {
    await call.startOutgoing(
        targetId: 'alice', conversationId: 'conv', isVideo: true);
    expect(call.network.peerCamera, isTrue);
    call.handleSignal({
      'type': 'call-merged',
      'callId': 'c-a',
      'conversationId': 'conv',
      'senderId': 'alice',
      'media': 'audio',
      'transport': 'sfu',
      'kind': 'direct',
    });
    await flush();
    expect(call.isVideo, isFalse);
    expect(call.cameraOn, isFalse);
    expect(call.network.peerCamera, isFalse);
    expect(showsVideo(call.cameraOn, call.network.peerCamera), isFalse);
    expect(sessions.single.connectVideo, isFalse);
  });

  group('call-accepted (F5)', () {
    Map<String, dynamic> accepted({String callId = 'c1'}) => {
          'type': 'call-accepted',
          'callId': callId,
          'conversationId': 'conv',
          'senderId': 'bob',
        };

    test('the callee answering is reported once and a late no-answer is moot',
        () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      port.events.add(started());
      await flush();
      call.handleSignal(accepted());
      call.handleSignal(accepted());
      expect(answered, 1);
      await call.endCall(reason: CallEndReason.noAnswer);
      expect(port.to('/app/call.cancel'), isEmpty);
      expect(call.isActive, isTrue);
      expect(notices, isEmpty);
    });

    test('an answer for another call changes nothing', () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      port.events.add(started());
      await flush();
      call.handleSignal(accepted(callId: 'other'));
      expect(answered, 0);
    });

    test('the callee never reaching the room ends the call after the deadline',
        () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      port.events.add(started());
      await flush();
      call.handleSignal(accepted());
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(notices,
          [(CallEndReason.failed, false, CallFailure.peerNeverJoined)]);
      expect(call.isActive, isFalse);
    });
  });

  test('after our own rejoin it stops re-joining while waiting for them (F6)',
      () async {
    final s = await connected();
    s.onDisconnected!(RtcEnd.failed);
    await flush();
    await flush();
    expect(sessions, hasLength(2));
    expect(call.network.reconnectWho, ReconnectWho.peer);
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(sessions, hasLength(2));
    expect(sessions.last.disconnected, isFalse);
  });

  group('connect deadline for the callee (F9)', () {
    test('the caller never joining ends the call as failed', () async {
      call.prepareIncoming(
          targetId: 'alice', conversationId: 'conv', callId: 'c1', isVideo: false);
      await call.answer();
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(notices,
          [(CallEndReason.failed, false, CallFailure.peerNeverJoined)]);
      expect(port.to('/app/call.leave'), [
        {'callId': 'c1'}
      ]);
      expect(call.isActive, isFalse);
    });

    test('no deadline once they are in the room', () async {
      call.prepareIncoming(
          targetId: 'alice', conversationId: 'conv', callId: 'c1', isVideo: false);
      await call.answer();
      sessions.single.join('alice');
      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(notices, isEmpty);
      expect(call.isActive, isTrue);
    });
  });

  group('a call.start the server never answers (W8)', () {
    test('ends after the deadline with its own message', () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(notices, [(CallEndReason.failed, false, CallFailure.startTimeout)]);
      expect(call.isActive, isFalse); // a new call is not answered "busy"
      expect(port.to('/app/call.cancel'), isEmpty); // no call id to cancel
      expect(port.held, ['conv']); // still waiting to cancel a late start…
      port.events.add(started());
      await flush();
      expect(port.to('/app/call.cancel'), [
        {'callId': 'c1', 'reason': 'hangup'}
      ]);
      expect(port.to('/app/call.leave'), [
        {'callId': 'c1'}
      ]);
      expect(sessions, isEmpty);
      expect(port.held, isEmpty);
    });

    test('…and stops waiting for that start after its own deadline', () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(notices, hasLength(1));
      expect(port.held, isEmpty);
    });

    test('an answer in time leaves no deadline behind', () async {
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      port.events.add(started());
      await flush();
      sessions.single.join('bob');
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(notices, isEmpty);
      expect(call.isActive, isTrue);
    });

    test('a merge in time leaves no deadline behind', () async {
      await call.startOutgoing(
          targetId: 'alice', conversationId: 'conv', isVideo: false);
      call.handleSignal({
        'type': 'call-merged',
        'callId': 'c-a',
        'conversationId': 'conv',
        'senderId': 'alice',
        'media': 'audio',
      });
      await flush();
      sessions.single.join('alice');
      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(notices, isEmpty);
    });
  });

  test(
      'call-blocked drops the attempt and its timers; the next call keeps its '
      'own (W2)', () async {
    await call.startOutgoing(
        targetId: 'bob', conversationId: 'conv', isVideo: false);
    await Future<void>.delayed(const Duration(milliseconds: 25));
    call.handleSignal({'type': 'call-blocked', 'conversationId': 'conv'});
    expect(call.isActive, isFalse);
    expect(port.held, isEmpty);
    expect(notices, isEmpty);

    // The next call: the first one's start deadline (due at ~40 ms) is gone.
    await call.startOutgoing(
        targetId: 'bob', conversationId: 'conv', isVideo: false);
    await Future<void>.delayed(const Duration(milliseconds: 25));
    expect(notices, isEmpty);
    expect(call.isActive, isTrue);
    await Future<void>.delayed(const Duration(milliseconds: 35));
    expect(notices, [(CallEndReason.failed, false, CallFailure.startTimeout)]);
  });

  group('token refusals (F10)', () {
    test('a refused token ends the call with its specific reason', () async {
      api.tokenError = _refused(403, 'CALL_FORBIDDEN');
      await call.startOutgoing(
          targetId: 'bob', conversationId: 'conv', isVideo: false);
      port.events.add(started());
      await flush();
      expect(notices, [(CallEndReason.failed, false, CallFailure.forbidden)]);
      expect(call.failure, isNull); // nothing carried into the next call
    });

    test('every CALL_* code and 503 map to their failure', () {
      expect(callFailureOf(_refused(503, 'CALLS_UNAVAILABLE')),
          CallFailure.unavailable);
      expect(callFailureOf(_refused(404, 'CALL_NOT_FOUND')),
          CallFailure.notFound);
      expect(callFailureOf(_refused(409, 'CALL_ENDED')), CallFailure.ended);
      expect(callFailureOf(_refused(409, 'CALL_NOT_SFU')), CallFailure.notSfu);
      expect(callFailureOf(_refused(403, 'CALL_FORBIDDEN')),
          CallFailure.forbidden);
      final req = RequestOptions(path: '/x');
      expect(
          callFailureOf(DioException(
              requestOptions: req,
              type: DioExceptionType.badResponse,
              response: Response(requestOptions: req, statusCode: 503))),
          CallFailure.unavailable);
      expect(callFailureOf(Exception('offline')), isNull);
      expect(callFailureOf(const CallRefusedException(CallFailure.ended)),
          CallFailure.ended);
    });
  });

  group('closing the call screen (F2)', () {
    test('a call still running when the screen goes away is ended', () async {
      void onEnded() {}
      await connected();
      call.onCallEnded = onEnded;
      releaseCallScreen(call, onEnded, duration: 12);
      expect(port.to('/app/call.leave'), [
        {'callId': 'c1'}
      ]);
      expect(call.isActive, isFalse);
      expect(call.onCallEnded, isNull);
    });

    test('a call already hung up is not ended twice', () async {
      void onEnded() {}
      await connected();
      call.onCallEnded = onEnded;
      await call.endCall(duration: 3);
      releaseCallScreen(call, onEnded);
      expect(port.to('/app/call.leave'), hasLength(1));
    });

    test('a call another screen took over is left alone', () async {
      void mine() {}
      void theirs() {}
      await connected();
      call.onCallEnded = theirs;
      releaseCallScreen(call, mine);
      expect(port.to('/app/call.leave'), isEmpty);
      expect(call.isActive, isTrue);
      expect(call.onCallEnded, same(theirs));
    });
  });

  test('DirectCallEngine exposes whether a call is running', () {
    final DirectCallEngine engine = call;
    expect(engine.isActive, isFalse);
  });
}
