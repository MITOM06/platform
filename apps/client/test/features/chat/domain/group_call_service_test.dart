import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/group_call_service.dart';

import '../../../core/rtc/fake_webrtc_platform.dart';
import 'call_test_stomp.dart';

/// Group mesh: one peer connection per participant, offer only to peers that
/// were there first (glare rule), ICE queued until the remote SDP is in, and
/// full teardown on leave.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeWebRtcPlatform native;
  late RecordingStomp stomp;
  late GroupCallService svc;

  setUp(() {
    native = FakeWebRtcPlatform()..install();
    stomp = RecordingStomp();
    svc = GroupCallService(stomp);
  });
  tearDown(() => native.uninstall());

  Map<String, Object?> ice(String c) =>
      {'candidate': c, 'sdpMid': '0', 'sdpMLineIndex': 0};

  test('local media: opened once, published to the renderer', () async {
    String? bound;
    svc.onLocalStream = (s) => bound = s.id;
    final s = await svc.startLocalMedia(isVideo: false);
    expect(bound, s.id);
    expect(svc.localStream, same(s));
    expect((native.named('getUserMedia').single.arguments as Map)['constraints'],
        {'audio': true, 'video': false});
  });

  test('isActive follows the call id', () {
    expect(svc.isActive, isFalse);
    svc.setCallId('call1');
    expect(svc.isActive, isTrue);
  });

  test('offers to every existing peer once, with callId + targetId',
      () async {
    svc.setCallId('call1');
    await svc.startLocalMedia(isVideo: true);
    await svc.offerToExistingPeers(['a', 'b']);
    await svc.offerToExistingPeers(['a']); // roster repeated: no new pc
    expect(native.named('createPeerConnection'), hasLength(2));
    expect(stomp.to('/app/call.offer'), [
      {'callId': 'call1', 'targetId': 'a', 'sdp': native.offerSdp},
      {'callId': 'call1', 'targetId': 'b', 'sdp': native.offerSdp},
    ]);
    // Each pc publishes both local tracks.
    expect(native.named('addTrack'), hasLength(4));
  });

  test('inbound offer from a later joiner is answered on a new pc', () async {
    svc.setCallId('call1');
    await svc.handleOffer('late', 'offer-sdp');
    expect(native.named('setRemoteDescription'), hasLength(1));
    expect(stomp.to('/app/call.answer').single,
        {'callId': 'call1', 'targetId': 'late', 'sdp': native.answerSdp});
  });

  test('answer from an unknown peer is ignored', () async {
    await svc.handleAnswer('ghost', 'sdp');
    expect(native.named('setRemoteDescription'), isEmpty);
  });

  test('ICE before the remote SDP waits, then flushes in order', () async {
    svc.setCallId('call1');
    await svc.handleIce('a', ice('c1')); // no pc yet
    await svc.offerToExistingPeers(['a']);
    await svc.handleIce('a', ice('c2')); // pc but no remote SDP yet
    expect(native.named('addCandidate'), isEmpty);
    await svc.handleAnswer('a', 'answer');
    final added = native
        .argsOf('addCandidate', 'candidate')
        .map((c) => (c as Map)['candidate'])
        .toList();
    expect(added, ['c1', 'c2']);
    await svc.handleIce('a', ice('c3')); // now applied directly
    expect(native.named('addCandidate'), hasLength(3));
  });

  test('our ICE / remote tracks are routed per peer', () async {
    svc.setCallId('call1');
    final remote = <String>[];
    svc.onRemoteStream = (peer, s) => remote.add('$peer:${s.id}');
    await svc.offerToExistingPeers(['a']);
    await native.iceCandidate('pc1', 'cand');
    expect(stomp.to('/app/call.ice').single,
        allOf(containsPair('callId', 'call1'), containsPair('targetId', 'a')));
    await native.remoteTrack('pc1', streamId: 'sa');
    await native.remoteTrack('pc1', streamId: null); // no stream: ignored
    expect(remote, ['a:sa']);
    await native.connectionState('pc1', 'failed'); // logged only
  });

  test('removePeer closes its pc and drops its queued ICE', () async {
    final removed = <String>[];
    svc.onPeerRemoved = removed.add;
    await svc.offerToExistingPeers(['a']);
    await svc.handleIce('a', ice('stale'));
    await svc.removePeer('a');
    expect(native.named('peerConnectionClose'), hasLength(1));
    expect(removed, ['a']);
    // Rejoin: a fresh pc, and the stale candidate is gone.
    await svc.handleOffer('a', 'offer');
    expect(native.named('addCandidate'), isEmpty);
  });

  test('removePeer of an unknown peer still reports removal', () async {
    final removed = <String>[];
    svc.onPeerRemoved = removed.add;
    await svc.removePeer('nobody');
    expect(removed, ['nobody']);
    expect(native.named('peerConnectionClose'), isEmpty);
  });

  test('mic / cam toggles only touch their own track kind', () async {
    await svc.startLocalMedia(isVideo: true);
    svc.setMicEnabled(false);
    svc.setCamEnabled(false);
    await pumpEventQueue();
    final toggled = native
        .named('mediaStreamTrackSetEnable')
        .map((c) => (c.arguments as Map)['trackId'] as String)
        .toList();
    expect(toggled.first, startsWith('a'));
    expect(toggled.last, startsWith('v'));
  });

  test('dispose closes every pc, stops tracks, forgets the call', () async {
    svc.setCallId('call1');
    await svc.startLocalMedia(isVideo: true);
    await svc.offerToExistingPeers(['a', 'b']);
    await svc.dispose();
    expect(native.named('peerConnectionClose'), hasLength(2));
    expect(native.named('trackDispose'), hasLength(2));
    expect(native.named('streamDispose'), hasLength(1));
    expect(svc.isActive, isFalse);
    expect(svc.localStream, isNull);
    // Disposed: an answer from a former peer finds nothing.
    await svc.handleAnswer('a', 'sdp');
    expect(native.named('setRemoteDescription'), isEmpty);
  });
}
