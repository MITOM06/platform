import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/chat/domain/call_rules.dart';
import 'package:platform_client/features/chat/domain/webrtc_service.dart';

import '../../../core/rtc/fake_webrtc_platform.dart';
import 'call_test_stomp.dart';

/// [WebRTCServiceInCall]: crossed calls, remote `end` (busy / declined /
/// stray), `call.state`, mid-call renegotiation and a camera turned on in a
/// voice call.
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

  Future<void> outgoing({bool video = true}) async {
    await svc.initialize('u2', 'c1', isVideo: video);
    await svc.makeCall();
  }

  Future<void> answered({bool video = true}) async {
    await svc.initialize('u1', 'c1', isVideo: video, incoming: true);
    await svc.handleOffer('offer');
  }

  group('answerCrossed (both tapped Call)', () {
    test('drops our offer, answers theirs keeping mute + camera-off choices',
        () async {
      await outgoing();
      await svc.setMicOn(false);
      await svc.setCameraOn(false);
      native.calls.clear();
      stomp.sent.clear();

      await svc.answerCrossed(
          from: 'u2', conversationId: 'c1', sdp: 'v=0\r\nm=video 9');
      await pumpEventQueue();

      expect(native.named('peerConnectionClose'), hasLength(1)); // our pc
      expect(native.named('createPeerConnection'), hasLength(1)); // fresh
      expect(svc.peerId, 'u2');
      expect(svc.isVideo, isTrue);
      expect(svc.micOn, isFalse);
      expect(svc.cameraOn, isFalse);
      // Their offer answered; our own offer is not re-sent.
      expect(stomp.to('/app/call.answer').single['targetId'], 'u2');
      expect(stomp.to('/app/call.offer'), isEmpty);
      // Not an end: the call screen stays.
      expect(ended, 0);
      expect(stomp.to('/app/call.end'), isEmpty);
    });

    test('their voice offer makes the call voice', () async {
      await outgoing();
      await svc.answerCrossed(
          from: 'u2', conversationId: 'c1', sdp: 'v=0\r\nm=audio 9');
      expect(svc.isVideo, isFalse);
    });

    test('setup failure ends the call as failed (peer told)', () async {
      await outgoing();
      native.failing.add('createPeerConnection');
      await svc.answerCrossed(from: 'u2', conversationId: 'c1', sdp: 'm=audio');
      expect(svc.isActive, isFalse);
      expect(stomp.to('/app/call.end').single['reason'], 'failed');
      expect(notices.last, (CallEndReason.failed, false));
    });
  });

  group('handleRemoteEnd', () {
    test('peer hangs up a running call: torn down, no log, no echo',
        () async {
      await answered();
      stomp.sent.clear();
      svc.handleRemoteEnd(from: 'u1', reasonWire: 'hangup');
      expect(svc.isActive, isFalse);
      expect(notices.single, (CallEndReason.hangup, true));
      expect(logs, isEmpty); // the initiator logs it, not us
      expect(stomp.sent, isEmpty);
      expect(ended, 1);
    });

    test('a stray end from someone else does not end the call', () async {
      await answered();
      svc.handleRemoteEnd(from: 'intruder', reasonWire: 'hangup');
      svc.handleRemoteEnd(reasonWire: 'hangup'); // no sender at all
      expect(svc.isActive, isTrue);
      expect(notices, isEmpty);
    });

    test('callee busy: caller logs a missed call and ends all their sessions',
        () async {
      await outgoing(video: false);
      stomp.sent.clear();
      svc.handleRemoteEnd(from: 'u2', reasonWire: 'busy');
      expect(logs, ['system.call.missed:voice']);
      expect(stomp.to('/app/call.end').single,
          containsPair('targetId', 'u2'));
      expect(notices.single, (CallEndReason.busy, true));
      expect(svc.isActive, isFalse);
    });

    test('callee declined: other sessions told, no log from us', () async {
      await outgoing();
      stomp.sent.clear();
      svc.handleRemoteEnd(from: 'u2', reasonWire: 'declined');
      expect(logs, isEmpty);
      expect(stomp.to('/app/call.end'), hasLength(1));
      expect(notices.single, (CallEndReason.declined, true));
    });

    test('unknown reason wire is treated as hangup', () async {
      await outgoing();
      svc.handleRemoteEnd(from: 'u2', reasonWire: 'garbage');
      expect(notices.single, (CallEndReason.hangup, true));
      expect(stomp.to('/app/call.end'), isEmpty);
    });

    test('caller cancels while we are still building the answer', () async {
      native.peerGate = Completer();
      final init = svc.initialize('u1', 'c1', incoming: true);
      await pumpEventQueue();
      svc.handleRemoteEnd(from: 'u1', reasonWire: 'hangup');
      native.peerGate!.complete();
      await expectLater(init, throwsA(isA<CallCancelledException>()));
      expect(ended, 1);
      expect(svc.isActive, isFalse);
    });

    test('caller cancels while only ringing: its early ICE is dropped',
        () async {
      svc.expectCallFrom('u1');
      await svc.handleIceCandidate({'candidate': 'c:early'}, senderId: 'u1');
      svc.handleRemoteEnd(from: 'u1');
      expect(ended, 0); // nothing was open
      // A later call from the same person must not inherit stale candidates.
      await answered();
      expect(native.named('addCandidate'), isEmpty);
    });
  });

  group('call.state', () {
    test('ignored when idle or not from the peer', () async {
      svc.handleState({'senderId': 'u1', 'video': true});
      expect(svc.isVideo, isTrue); // default untouched
      await answered(video: false);
      svc.handleState({'senderId': 'other', 'video': true});
      expect(svc.isVideo, isFalse);
      expect(svc.network.peerCamera, isFalse);
    });

    test('peer camera on in a voice call: video call + loudspeaker',
        () async {
      await answered(video: false);
      native.calls.clear();
      svc.handleState({'senderId': 'u1', 'video': true});
      await pumpEventQueue();
      expect(svc.isVideo, isTrue);
      expect(svc.network.peerCamera, isTrue);
      expect(native.argsOf('enableSpeakerphone', 'enable'), [true]);
    });

    test('callee asks for a reconnect: caller ICE-restarts with a new offer',
        () async {
      await outgoing();
      await native.signalingState('pc1', 'have-local-offer');
      await svc.handleAnswer('answer');
      native.calls.clear();
      stomp.sent.clear();
      svc.handleState({'senderId': 'u2', 'restart': true});
      await pumpEventQueue();
      final offer = native.named('createOffer').single.arguments as Map;
      expect(offer['constraints'], {'iceRestart': true});
      expect(stomp.to('/app/call.offer'), hasLength(1));
    });
  });

  test('answerRenegotiation answers the caller mid-call', () async {
    await answered();
    stomp.sent.clear();
    await svc.answerRenegotiation('offer-2');
    expect(native.named('setRemoteDescription'), hasLength(2));
    expect(stomp.to('/app/call.answer').single['targetId'], 'u1');
  });

  group('camera on in a voice call', () {
    test('caller: opens the camera, adds the track, renegotiates', () async {
      await outgoing(video: false);
      native.calls.clear();
      stomp.sent.clear();
      await svc.setCameraOn(true);
      await pumpEventQueue();
      expect((native.named('getUserMedia').single.arguments as Map)['constraints'],
          {'video': true});
      expect(native.named('addTrack'), hasLength(1));
      expect(stomp.to('/app/call.offer'), hasLength(1));
      expect(stomp.to('/app/call.state').single, containsPair('video', true));
      expect(svc.cameraOn, isTrue);
      expect(svc.isVideo, isTrue);
    });

    test('callee: holds the camera and asks the caller for a video line',
        () async {
      await answered(video: false);
      native.calls.clear();
      stomp.sent.clear();
      await svc.setCameraOn(true);
      expect(native.named('addTrack'), isEmpty);
      expect(stomp.to('/app/call.state').single,
          allOf(containsPair('video', true), containsPair('restart', true)));
      expect(svc.cameraOn, isTrue);
    });

    test('camera refused: the call stays voice', () async {
      await outgoing(video: false);
      native.onGetUserMedia =
          (_) => throw PlatformException(code: 'NotAllowedError');
      await svc.setCameraOn(true);
      expect(svc.cameraOn, isFalse);
      expect(svc.isVideo, isFalse);
      expect(stomp.to('/app/call.state'), isEmpty);
    });

    test('no camera track returned: the capture is released', () async {
      await outgoing(video: false);
      native.onGetUserMedia = (_) async => native.userMedia(video: false);
      native.calls.clear();
      await svc.setCameraOn(true);
      expect(native.named('streamDispose'), hasLength(1));
      expect(svc.isVideo, isFalse);
    });

    test('without an active call nothing is opened', () async {
      await svc.setCameraOn(true);
      expect(native.named('getUserMedia'), isEmpty);
    });
  });

  test('callee camera: an old caller never offers → camera off again, notice',
      () {
    fakeAsync((async) {
      unawaited(answered(video: false));
      async.flushMicrotasks();
      unawaited(svc.setCameraOn(true));
      async.flushMicrotasks();
      expect(svc.cameraOn, isTrue);
      stomp.sent.clear();
      native.calls.clear();
      async.elapse(const Duration(seconds: 5));
      async.flushMicrotasks();
      expect(svc.cameraOn, isFalse);
      expect(svc.isVideo, isFalse); // back to the voice call it was
      expect(svc.network.videoUnavailable, isTrue);
      expect(stomp.to('/app/call.state').single, containsPair('video', false));
      // The held camera leaves the call's stream and is stopped.
      expect(native.named('mediaStreamRemoveTrack'), hasLength(1));
      expect(native.named('trackDispose'), hasLength(1));
      async.elapse(const Duration(seconds: 6));
      expect(svc.network.videoUnavailable, isFalse);
      svc.dispose();
    });
  });
}
