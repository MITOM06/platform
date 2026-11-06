import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_rules.dart';
import 'package:platform_client/features/chat/domain/webrtc_service.dart';

import '../../../core/rtc/fake_webrtc_platform.dart';
import 'call_test_stomp.dart';

/// 1-1 peer-to-peer call state machine: ringing → connected → ended, the
/// call log written exactly once, cancel-before-answer, late/duplicate SDP,
/// teardown of every native resource. Only the plugin's native side is faked.

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeWebRtcPlatform native;
  late RecordingStomp stomp;
  late WebRTCService svc;
  late List<String> logs;
  late List<(CallEndReason, bool)> notices;
  late int ended;

  setUp(() {
    native = FakeWebRtcPlatform()..install();
    stomp = RecordingStomp();
    svc = WebRTCService(stomp);
    logs = [];
    notices = [];
    ended = 0;
    svc
      ..onSendCallLog = logs.add
      ..onEndNotice = ((r, byPeer) => notices.add((r, byPeer)))
      ..onCallEnded = () => ended++;
  });
  tearDown(() => native.uninstall());

  group('static helpers', () {
    test('sdpHasVideo: only an m=video section counts', () {
      expect(WebRTCService.sdpHasVideo(null), isFalse);
      expect(WebRTCService.sdpHasVideo('m=audio 9'), isFalse);
      expect(WebRTCService.sdpHasVideo('m=audio 9\r\nm=video 9'), isTrue);
    });

    test('missedCallLog names the call kind', () {
      expect(WebRTCService.missedCallLog(isVideo: true),
          'system.call.missed:video');
      expect(WebRTCService.missedCallLog(isVideo: false),
          'system.call.missed:voice');
    });

    test('sendEnd publishes call.end with reason wire + duration', () {
      svc.sendEnd(
          targetId: 'u2',
          conversationId: 'c1',
          duration: 12,
          reason: CallEndReason.declined);
      expect(stomp.to('/app/call.end'), [
        {
          'targetId': 'u2',
          'conversationId': 'c1',
          'type': 'end',
          'reason': 'declined',
          'duration': 12,
        }
      ]);
    });
  });

  group('idle (no peer connection)', () {
    test('is inactive with no peer, makeCall/handleOffer refuse', () async {
      expect(svc.isActive, isFalse);
      expect(svc.peerId, isNull);
      await expectLater(svc.makeCall(), throwsA(isA<CallCancelledException>()));
      await expectLater(
          svc.handleOffer('sdp'), throwsA(isA<CallCancelledException>()));
      await svc.handleAnswer('sdp'); // no-op, no throw
      expect(native.named('setRemoteDescription'), isEmpty);
    });

    test('endCall before anything was signaled: no end signal, no log',
        () async {
      await svc.endCall(duration: 0);
      expect(stomp.sent, isEmpty);
      expect(logs, isEmpty);
      expect(notices, [(CallEndReason.hangup, false)]);
      expect(ended, 1);
    });

    test('failLocally tells the screen why, sends nothing', () {
      svc.failLocally(CallEndReason.mediaError);
      expect(stomp.sent, isEmpty);
      expect(notices, [(CallEndReason.mediaError, false)]);
      expect(ended, 1);
    });
  });

  group('outgoing call', () {
    Future<void> dial({bool video = true}) async {
      await svc.initialize('u2', 'c1', isVideo: video);
      await svc.makeCall();
    }

    test('initialize opens a pc + media, publishes tracks, picks speaker',
        () async {
      String? local;
      svc.onLocalStream = (s) => local = s.id;
      await svc.initialize('u2', 'c1', isVideo: true);
      expect(svc.isActive, isTrue);
      expect(svc.peerId, 'u2');
      expect(svc.isVideo, isTrue);
      expect(svc.cameraOn, isTrue);
      expect(svc.micOn, isTrue);
      expect(local, 'local1');
      final gum = native.named('getUserMedia').single.arguments as Map;
      expect(gum['constraints'], {'audio': true, 'video': true});
      expect(native.named('addTrack'), hasLength(2)); // audio + video
      // Video call → loudspeaker.
      expect(native.argsOf('enableSpeakerphone', 'enable').last, isTrue);
      expect(svc.speakerOn, isTrue);
    });

    test('voice call: no camera requested, earpiece', () async {
      await svc.initialize('u2', 'c1', isVideo: false);
      final gum = native.named('getUserMedia').single.arguments as Map;
      expect(gum['constraints'], {'audio': true, 'video': false});
      expect(svc.speakerOn, isFalse);
      expect(svc.cameraOn, isFalse);
    });

    test('makeCall sends the offer to the peer', () async {
      await dial();
      expect(stomp.to('/app/call.offer'), [
        {
          'targetId': 'u2',
          'conversationId': 'c1',
          'type': 'offer',
          'sdp': native.offerSdp,
        }
      ]);
      expect(svc.isCallingTo('u2', 'c1'), isTrue);
      expect(svc.isCallingTo('u3', 'c1'), isFalse);
      expect(svc.isCallingTo('u2', 'other'), isFalse);
    });

    test('our own ICE candidates are relayed to the peer', () async {
      await dial();
      await native.iceCandidate('pc1', 'candidate:1 udp');
      expect(stomp.to('/app/call.ice').single, {
        'targetId': 'u2',
        'conversationId': 'c1',
        'type': 'ice',
        'candidate': {
          'candidate': 'candidate:1 udp',
          'sdpMid': '0',
          'sdpMLineIndex': 0
        },
      });
    });

    test('caller cancels before answer: end + MISSED log, teardown', () async {
      await dial(video: false);
      await svc.endCall(duration: 0);
      await pumpEventQueue();
      expect(stomp.to('/app/call.end').single['reason'], 'hangup');
      expect(logs, ['system.call.missed:voice']);
      expect(svc.isActive, isFalse);
      expect(native.named('peerConnectionClose'), hasLength(1));
      expect(native.named('peerConnectionDispose'), hasLength(1));
      // Local tracks stopped and stream released (camera/mic light off).
      expect(native.named('trackDispose'), hasLength(1));
      expect(native.named('streamDispose'), hasLength(1));
      expect(ended, 1);
    });

    test('ring timeout is reported with noAnswer reason', () async {
      await dial();
      await svc.endCall(reason: CallEndReason.noAnswer);
      expect(stomp.to('/app/call.end').single['reason'], 'no_answer');
      expect(logs, ['system.call.missed:video']);
      expect(notices.single, (CallEndReason.noAnswer, false));
    });

    test('hanging up before the offer left: nothing sent, nothing logged',
        () async {
      await svc.initialize('u2', 'c1');
      await svc.endCall();
      expect(stomp.sent, isEmpty);
      expect(logs, isEmpty);
      expect(svc.isActive, isFalse);
    });

    test('answer → connected: ENDED log with the duration', () async {
      await dial();
      await native.signalingState('pc1', 'have-local-offer');
      await svc.handleAnswer('answer-sdp');
      expect(native.named('setRemoteDescription'), hasLength(1));
      expect(svc.isCallingTo('u2', 'c1'), isFalse); // answered
      await svc.endCall(duration: 42);
      expect(stomp.to('/app/call.end').single['duration'], 42);
      expect(logs, ['system.call.ended:video:42']);
    });

    test('a duplicate / late answer is ignored', () async {
      await dial();
      await native.signalingState('pc1', 'stable');
      await svc.handleAnswer('late');
      expect(native.named('setRemoteDescription'), isEmpty);
      expect(svc.isCallingTo('u2', 'c1'), isTrue); // still ringing
    });

    test('an answer the native side rejects does not crash the call',
        () async {
      await dial();
      native.failing.add('setRemoteDescription');
      await svc.handleAnswer('bad');
      expect(svc.isActive, isTrue);
    });

    test('never connected + ICE failed → ends as failed', () async {
      await dial();
      await native.connectionState('pc1', 'failed');
      expect(svc.isActive, isFalse);
      expect(stomp.to('/app/call.end').single['reason'], 'failed');
      expect(notices.single, (CallEndReason.failed, false));
    });

    test('never connected + disconnected: keeps ringing (no end)', () async {
      await dial();
      await native.connectionState('pc1', 'disconnected');
      expect(svc.isActive, isTrue);
      expect(stomp.to('/app/call.end'), isEmpty);
    });

    test('connected then dropped: waits to reconnect instead of ending',
        () async {
      await dial();
      await native.connectionState('pc1', 'connected');
      await native.connectionState('pc1', 'failed');
      expect(svc.isActive, isTrue);
      expect(stomp.to('/app/call.end'), isEmpty);
    });

    test('events from a torn-down pc are ignored', () async {
      await dial();
      await svc.endCall();
      stomp.sent.clear();
      await native.connectionState('pc1', 'failed');
      expect(stomp.sent, isEmpty);
      expect(notices, hasLength(1));
    });
  });

  group('incoming call', () {
    test('answering: remote offer applied, answer sent, early ICE kept',
        () async {
      svc.expectCallFrom('u1');
      // Caller trickles a candidate while we are still ringing (no pc).
      await svc.handleIceCandidate(
          {'candidate': 'c:early', 'sdpMid': '0', 'sdpMLineIndex': 0},
          senderId: 'u1');
      expect(native.named('addCandidate'), isEmpty);
      await svc.initialize('u1', 'c1', isVideo: false, incoming: true);
      await svc.handleOffer('offer-sdp');
      expect(native.named('setRemoteDescription'), hasLength(1));
      // The buffered early candidate is applied once the offer is in.
      expect(native.argsOf('addCandidate', 'candidate').single,
          containsPair('candidate', 'c:early'));
      expect(stomp.to('/app/call.answer').single, {
        'targetId': 'u1',
        'conversationId': 'c1',
        'type': 'answer',
        'sdp': native.answerSdp,
      });
    });

    test('candidates from a stranger while ringing are dropped', () async {
      svc.expectCallFrom('u1');
      await svc.handleIceCandidate({'candidate': 'c:x'}, senderId: 'evil');
      await svc.initialize('u1', 'c1', incoming: true);
      await svc.handleOffer('offer');
      expect(native.named('addCandidate'), isEmpty);
    });

    test('callee hangs up an answered call: ENDED log, end signal', () async {
      await svc.initialize('u1', 'c1', isVideo: false, incoming: true);
      await svc.handleOffer('offer');
      await svc.endCall(duration: 5);
      expect(logs, ['system.call.ended:voice:5']);
      expect(stomp.to('/app/call.end').single['targetId'], 'u1');
    });

    test('remote media: onTrack hands the stream to the screen', () async {
      final remote = <String>[];
      svc.onRemoteStream = (s) => remote.add(s.id);
      await svc.initialize('u1', 'c1', incoming: true);
      await native.remoteTrack('pc1', streamId: 'r9');
      expect(remote, ['r9']);
      expect(svc.isInCallWith('u1', 'c1'), isTrue);
      expect(svc.isInCallWith('u1', 'other'), isFalse);
    });

    test('a streamless track before any remote stream is ignored', () async {
      final remote = <String>[];
      svc.onRemoteStream = (s) => remote.add(s.id);
      await svc.initialize('u1', 'c1', incoming: true);
      await native.remoteTrack('pc1', streamId: null);
      expect(remote, isEmpty);
    });

    test('a streamless video track joins the existing remote stream',
        () async {
      final remote = <String>[];
      svc.onRemoteStream = (s) => remote.add(s.id);
      await svc.initialize('u1', 'c1', incoming: true);
      await native.remoteTrack('pc1', streamId: 'r1', kind: 'audio');
      await native.remoteTrack('pc1', streamId: null);
      expect(remote, ['r1', 'r1']);
      expect(native.named('mediaStreamAddTrack'), hasLength(1));
    });
  });

  group('cancelled mid-setup (generation guard)', () {
    test('ended while createPeerConnection pending: pc closed, cancelled',
        () async {
      native.peerGate = Completer();
      final init = svc.initialize('u2', 'c1');
      await pumpEventQueue();
      svc.dispose(); // hang up while the native side is still busy
      native.peerGate!.complete();
      await expectLater(init, throwsA(isA<CallCancelledException>()));
      expect(svc.isActive, isFalse);
      expect(native.named('peerConnectionClose'), hasLength(1));
      expect(native.named('getUserMedia'), isEmpty);
    });

    test('ended while the permission dialog is open: late stream released',
        () async {
      final gum = Completer<Map<String, Object?>>();
      native.onGetUserMedia = (_) => gum.future;
      final init = svc.initialize('u2', 'c1');
      await pumpEventQueue();
      svc.dispose();
      gum.complete(native.userMedia());
      await expectLater(init, throwsA(isA<CallCancelledException>()));
      expect(native.named('trackDispose'), hasLength(2));
      expect(native.named('streamDispose'), hasLength(1));
      expect(native.named('addTrack'), isEmpty);
    });

    test('permission refused: initialize throws, caller decides', () async {
      native.onGetUserMedia =
          (_) => throw PlatformException(code: 'NotAllowedError');
      await expectLater(svc.initialize('u2', 'c1'), throwsA(anything));
    });

    test('ended while createOffer is pending: no offer leaves', () async {
      await svc.initialize('u2', 'c1');
      final call = svc.makeCall();
      svc.dispose();
      await expectLater(call, throwsA(isA<CallCancelledException>()));
      expect(stomp.to('/app/call.offer'), isEmpty);
    });

    test('ended while answering: no answer leaves', () async {
      await svc.initialize('u1', 'c1', incoming: true);
      final answer = svc.handleOffer('offer');
      svc.dispose();
      await expectLater(answer, throwsA(isA<CallCancelledException>()));
      expect(stomp.to('/app/call.answer'), isEmpty);
    });
  });

  group('media controls', () {
    test('mic toggles every audio track', () async {
      await svc.initialize('u2', 'c1');
      await svc.setMicOn(false);
      expect(svc.micOn, isFalse);
      final set = native.named('mediaStreamTrackSetEnable').single;
      expect((set.arguments as Map)['enabled'], isFalse);
      expect((set.arguments as Map)['trackId'], startsWith('a'));
    });

    test('camera off in a video call: tracks disabled + call.state sent',
        () async {
      await svc.initialize('u2', 'c1');
      await svc.makeCall();
      await svc.setCameraOn(false);
      expect(svc.cameraOn, isFalse);
      expect(stomp.to('/app/call.state').last,
          containsPair('video', false));
    });

    test('switchCamera uses the video track; voice call does nothing',
        () async {
      await svc.initialize('u2', 'c1', isVideo: false);
      await svc.switchCamera();
      expect(native.named('mediaStreamTrackSwitchCamera'), isEmpty);
      await svc.endCall();
      await svc.initialize('u2', 'c1');
      await svc.switchCamera();
      expect(native.named('mediaStreamTrackSwitchCamera'), hasLength(1));
    });
  });

}
