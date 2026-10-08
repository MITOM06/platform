import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';

/// A [MeetingRtcSession] that records what the room asked for (no plugins).
class FakeRoomSession implements MeetingRtcSession {
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
  @override
  void Function(LocalMediaState state)? onLocalMediaChanged;
  @override
  void Function(String topic, List<int> payload, String? fromIdentity)? onData;

  final connects = <(String url, String token, MeetingConnectOptions options)>[];
  final connectErrors = <Object>[];
  final micCalls = <bool>[], cameraCalls = <bool>[], shareCalls = <bool>[];
  final sent = <(String topic, List<int> payload, bool reliable)>[];
  final videoEnabled = <(String, bool)>[];
  final speakerCalls = <bool>[];
  int disconnects = 0;
  int cameraSwitches = 0;
  Object? micError, shareError;
  LocalMediaState media = const LocalMediaState(mic: true, camera: false, screen: false);
  List<RtcPeer> fakePeers = [];

  @override
  Future<void> connectMeeting(String url, String token, MeetingConnectOptions options) async {
    connects.add((url, token, options));
    if (connectErrors.isNotEmpty) throw connectErrors.removeAt(0);
  }

  @override
  Future<void> connect(String url, String token, {required bool video}) =>
      connectMeeting(url, token, MeetingConnectOptions(video: video));

  @override
  Future<void> setMic(bool on) async {
    micCalls.add(on);
    final e = micError;
    micError = null;
    if (e != null) throw e;
  }

  @override
  Future<void> setCamera(bool on) async => cameraCalls.add(on);

  @override
  Future<void> setScreenShare(bool on, {ScreenShareNotice? notice}) async {
    shareCalls.add(on);
    final e = shareError;
    shareError = null;
    if (e != null) throw e;
  }

  @override
  void publishData(String topic, List<int> payload, {bool reliable = false}) =>
      sent.add((topic, payload, reliable));

  @override
  void setPeerVideoEnabled(String identity, bool enabled) => videoEnabled.add((identity, enabled));

  @override
  Future<void> disconnect() async => disconnects++;

  @override
  Future<void> switchCamera() async => cameraSwitches++;

  @override
  Future<void> setSpeaker(bool on) async => speakerCalls.add(on);

  @override
  RtcPeer? peer(String identity) {
    for (final p in fakePeers) {
      if (p.identity == identity) return p;
    }
    return null;
  }

  @override
  List<RtcPeer> get peers => List.unmodifiable(fakePeers);

  @override
  MediaStream? get localStream => null;

  @override
  MediaStream? get localScreenStream => null;

  @override
  LocalMediaState get localMedia => media;

  @override
  bool get supportsScreenShare => true;
}
