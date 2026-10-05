import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/features/chat/data/calls_repository.dart';
import 'package:platform_client/features/chat/domain/sfu_group_media.dart';

class _FakeStream implements MediaStream {
  @override
  dynamic noSuchMethod(Invocation i) => null;
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

class _Session implements RtcSession {
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
  bool? video;
  bool disconnected = false;
  final mic = <bool>[];

  @override
  Future<void> connect(String url, String token, {required bool video}) async =>
      this.video = video;
  void set(Map<String, MediaStream?> peers) {
    _peers
      ..clear()
      ..addAll({
        for (final e in peers.entries)
          e.key: RtcPeer(identity: e.key, name: '', stream: e.value)
      });
    onPeersChanged?.call(this.peers);
  }

  @override
  RtcPeer? peer(String identity) => _peers[identity];
  @override
  List<RtcPeer> get peers => _peers.values.toList();
  @override
  MediaStream? get localStream => null;
  @override
  Future<void> setMic(bool on) async => mic.add(on);
  @override
  Future<void> setCamera(bool on) async {}
  @override
  Future<void> switchCamera() async {}
  @override
  Future<void> setSpeaker(bool on) async {}
  @override
  Future<void> disconnect() async => disconnected = true;
}

void main() {
  late _Api api;
  late _Session session;
  late List<_Session> made;
  late SfuGroupMedia media;
  late List<String> remote;
  late List<String> removed;
  late List<RtcEnd> ends;

  setUp(() {
    api = _Api();
    made = [];
    media = SfuGroupMedia(
      api: api,
      sessionFactory: () {
        session = _Session();
        made.add(session);
        return session;
      },
    )
      ..onRemoteStream = ((id, _) => remote.add(id))
      ..onPeerRemoved = ((id) => removed.add(id))
      ..onRoomGone = ((reason) => ends.add(reason));
    remote = [];
    removed = [];
    ends = [];
  });

  test('enters the room with a token for the call', () async {
    await media.start('c1', isVideo: true);
    expect(session.video, isTrue);
  });

  test('hands each peer stream to the UI once and reports who left', () async {
    await media.start('c1', isVideo: false);
    final bob = _FakeStream();
    session.set({'bob': bob});
    session.set({'bob': bob}); // a speaking change — same stream
    session.set({'bob': bob, 'carol': _FakeStream()});
    session.set({'carol': session.peer('carol')!.stream});
    expect(remote, ['bob', 'carol']);
    expect(removed, ['bob']);
  });

  test('a server-closed or dropped room is reported', () async {
    await media.start('c1', isVideo: false);
    session.onDisconnected!(RtcEnd.ended);
    expect(ends, [RtcEnd.ended]);
  });

  test('a token failure makes the join fail, so no call screen opens', () async {
    api.tokenError = Exception('503');
    await expectLater(media.start('c1', isVideo: false), throwsA(isA<RoomConnectException>()));
    expect(ends, isEmpty);
  });

  test('starting another call leaves the previous room first', () async {
    await media.start('c1', isVideo: false);
    await media.start('c2', isVideo: false);
    expect(made, hasLength(2));
    expect(made.first.disconnected, isTrue);
  });

  test('mic toggles reach the room and dispose leaves it', () async {
    await media.start('c1', isVideo: false);
    media.setMicEnabled(false);
    await media.dispose();
    expect(session.mic, [false]);
    expect(session.disconnected, isTrue);
  });
}
