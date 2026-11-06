import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/rtc/livekit_session.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/core/rtc/screen_capture.dart';

import 'fake_webrtc_platform.dart';

/// [LiveKitSession] outside a room: every control is a safe no-op, nothing
/// leaks. connect() and the room events need a live LiveKit `Room`, which
/// this class constructs itself (no injectable factory) — not unit-testable
/// without a real server.

class _Capture implements ScreenCaptureHost {
  @override
  final bool supported = true;
  int begins = 0;
  int ends = 0;

  @override
  Future<bool> begin(ScreenShareNotice notice) async {
    begins++;
    return true;
  }

  @override
  Future<void> end() async => ends++;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeWebRtcPlatform native;
  late _Capture capture;
  late LiveKitSession s;

  setUp(() {
    native = FakeWebRtcPlatform()..install();
    capture = _Capture();
    s = LiveKitSession(capture: capture);
  });
  tearDown(() => native.uninstall());

  test('no room: nothing published, no peers, no streams', () {
    expect(s.localMedia,
        const LocalMediaState(mic: false, camera: false, screen: false));
    expect(s.localStream, isNull);
    expect(s.localScreenStream, isNull);
    expect(s.peers, isEmpty);
    expect(s.peer('anyone'), isNull);
  });

  test('screen-share support comes from the capture host', () {
    expect(s.supportsScreenShare, isTrue);
    expect(LiveKitSession().supportsScreenShare, isFalse); // NoScreenCapture
  });

  test('controls without a room are no-ops (no capture consent asked)',
      () async {
    await s.setMic(false);
    await s.setCamera(true);
    await s.switchCamera();
    await s.setSpeaker(true);
    await s.setScreenShare(true);
    s.publishData('reaction', [1, 2, 3]);
    s.setPeerVideoEnabled('u1', false);
    s.setPeerVideoEnabled('u1', true);
    expect(capture.begins, 0);
    expect(native.named('mediaStreamTrackSwitchCamera'), isEmpty);
  });

  test('disconnect releases the capture service even without a room', () async {
    await s.disconnect();
    expect(capture.ends, 1);
    expect(s.peers, isEmpty);
  });
}
