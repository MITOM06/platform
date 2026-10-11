import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/domain/call_failure.dart';
import 'package:platform_client/features/chat/domain/sfu_group_media.dart';

/// Group calls on LiveKit (QC 2026-10-11): a mute / camera-off tapped while
/// joining stands (F3), and a refused room says why (F8).

class _Api implements CallsApi {
  Object? tokenError;
  Completer<void>? tokenGate;
  @override
  Future<CallConfig> getConfig() async =>
      const CallConfig(transport: CallTransport.sfu);
  @override
  Future<CallToken> getToken(String callId) async {
    if (tokenGate != null) await tokenGate!.future;
    if (tokenError != null) throw tokenError!;
    return const CallToken(url: 'wss://rtc', token: 'tok');
  }
}

/// Publishes like LiveKit: the mic always, the camera when asked.
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
  bool? connectVideo;
  bool mic = false;
  bool camera = false;

  @override
  Future<void> connect(String url, String token, {required bool video}) async {
    connectVideo = video;
    if (gate != null) await gate!.future;
    mic = true;
    camera = video;
  }

  @override
  RtcPeer? peer(String identity) => null;
  @override
  List<RtcPeer> get peers => const [];
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
  Future<void> disconnect() async {}
}

void main() {
  late _Api api;
  late List<_Session> made;
  Completer<void>? connectGate;
  late SfuGroupMedia media;

  setUp(() {
    api = _Api();
    made = [];
    connectGate = null;
    media = SfuGroupMedia(
      api: api,
      sessionFactory: () {
        final s = _Session(connectGate);
        made.add(s);
        return s;
      },
    );
  });

  tearDown(() => media.dispose());

  test('mute and camera-off tapped while the room connects stand', () async {
    connectGate = Completer<void>();
    final gate = connectGate!;
    final starting = media.start('c1', isVideo: true);
    await Future<void>.delayed(Duration.zero);
    expect(made, hasLength(1));
    media.setMicEnabled(false);
    media.setCamEnabled(false);
    gate.complete();
    await starting;
    expect(made.single.mic, isFalse);
    expect(made.single.camera, isFalse);
  });

  test('toggles made before the room exists are applied once in it',
      () async {
    api.tokenGate = Completer<void>();
    final starting = media.start('c1', isVideo: true);
    await Future<void>.delayed(Duration.zero);
    expect(made, isEmpty); // still fetching the token
    media.setMicEnabled(false);
    media.setCamEnabled(false);
    api.tokenGate!.complete();
    await starting;
    expect(made.single.connectVideo, isFalse);
    expect(made.single.mic, isFalse);
    expect(made.single.camera, isFalse);
  });

  test('a new call starts with the mic on again', () async {
    media.setMicEnabled(false);
    await media.start('c1', isVideo: false);
    expect(made.single.mic, isTrue);
  });

  test('a refused room carries its reason', () async {
    final req = RequestOptions(path: '/api/calls/c1/token');
    api.tokenError = DioException(
      requestOptions: req,
      type: DioExceptionType.badResponse,
      response: Response(
          requestOptions: req,
          statusCode: 503,
          data: {'error': 'x', 'code': 'CALLS_UNAVAILABLE', 'statusCode': 503}),
    );
    await expectLater(
      media.start('c1', isVideo: false),
      throwsA(isA<CallRefusedException>()
          .having((e) => e.failure, 'failure', CallFailure.unavailable)),
    );
  });
}
