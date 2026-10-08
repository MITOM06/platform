import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/features/chat/domain/mesh_negotiator.dart';

class _Track implements MediaStreamTrack {
  _Track(this._kind);
  final String _kind;
  @override
  String? get kind => _kind;
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Stream implements MediaStream {
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Sender implements RTCRtpSender {
  MediaStreamTrack? replaced;
  List<MediaStream>? streams;
  @override
  Future<void> replaceTrack(MediaStreamTrack? track) async => replaced = track;
  @override
  Future<void> setStreams(List<MediaStream> s) async => streams = s;
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Receiver implements RTCRtpReceiver {
  _Receiver(this._track);
  final MediaStreamTrack? _track;
  @override
  MediaStreamTrack? get track => _track;
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Transceiver implements RTCRtpTransceiver {
  _Transceiver(String kind) : receiver = _Receiver(_Track(kind));
  @override
  final _Sender sender = _Sender();
  @override
  final RTCRtpReceiver receiver;
  TransceiverDirection? direction;
  @override
  Future<void> setDirection(TransceiverDirection d) async => direction = d;
  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _Pc implements RTCPeerConnection {
  final lines = <_Transceiver>[];
  final added = <(MediaStreamTrack, MediaStream)>[];
  @override
  Future<RTCRtpSender> addTrack(MediaStreamTrack track,
      [MediaStream? stream]) async {
    added.add((track, stream!));
    return _Sender();
  }

  final offerConstraints = <Map<String, dynamic>?>[];
  final remote = <RTCSessionDescription>[];
  @override
  Future<RTCSessionDescription> createOffer(
      [Map<String, dynamic>? constraints]) async {
    offerConstraints.add(constraints);
    return RTCSessionDescription('offer-sdp', 'offer');
  }

  @override
  Future<RTCSessionDescription> createAnswer(
          [Map<String, dynamic>? constraints]) async =>
      RTCSessionDescription('answer-sdp', 'answer');
  @override
  Future<void> setLocalDescription(RTCSessionDescription d) async {}
  @override
  Future<void> setRemoteDescription(RTCSessionDescription d) async =>
      remote.add(d);
  @override
  Future<List<RTCRtpTransceiver>> getTransceivers() async =>
      List<RTCRtpTransceiver>.of(lines);
  @override
  Future<RTCRtpTransceiver> addTransceiver(
      {MediaStreamTrack? track,
      RTCRtpMediaType? kind,
      RTCRtpTransceiverInit? init}) async {
    final t = _Transceiver('video')..direction = init?.direction;
    lines.add(t);
    return t;
  }

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

void main() {
  late _Pc pc;
  late List<(String, Map<String, dynamic>)> sent;
  late MeshNegotiator negotiator;

  setUp(() {
    pc = _Pc();
    sent = [];
    negotiator = MeshNegotiator(
      pc: () => pc,
      target: () => (peerId: 'bob', conversationId: 'conv'),
      flush: (_) async {},
      send: (d, b) => sent.add((d, b)),
    );
  });

  List<Map<String, dynamic>> to(String d) =>
      sent.where((s) => s.$1 == d).map((s) => s.$2).toList();

  test('the caller sends a fresh offer', () async {
    await negotiator.offer();
    expect(to('/app/call.offer'), [
      {
        'targetId': 'bob',
        'conversationId': 'conv',
        'type': 'offer',
        'sdp': 'offer-sdp'
      }
    ]);
  });

  test('an ICE restart asks for fresh candidates', () async {
    await negotiator.offer(iceRestart: true);
    expect(pc.offerConstraints.single, {'iceRestart': true});
  });

  test('one renegotiation at a time; the next runs after the answer', () async {
    await negotiator.offer();
    await negotiator.offer();
    expect(to('/app/call.offer'), hasLength(1));
    negotiator.answered();
    await Future<void>.delayed(Duration.zero);
    expect(to('/app/call.offer'), hasLength(2));
  });

  test('restart offers never overlap: a fresh one is not replaced', () async {
    await negotiator.offer(iceRestart: true);
    await negotiator.offer(iceRestart: true);
    expect(to('/app/call.offer'), hasLength(1));
  });

  test('adds a video line the callee can send on', () async {
    await negotiator.offer(videoLine: true);
    expect(pc.lines.single.direction, TransceiverDirection.RecvOnly);
  });

  test("the callee answers and sends a held camera on the caller's video line",
      () async {
    final camera = _Track('video');
    final stream = _Stream();
    negotiator.holdCamera(camera, stream);
    final line = _Transceiver('video');
    pc.lines.add(line);

    expect(await negotiator.answer('remote-sdp'), isTrue);
    expect(pc.remote.single.sdp, 'remote-sdp');
    // addTrack reuses that video line and carries our stream.
    expect(pc.added.single, (camera, stream));
    expect(line.sender.replaced, isNull);
    expect(to('/app/call.answer').single['sdp'], 'answer-sdp');
  });
}
