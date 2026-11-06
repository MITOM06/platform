import 'dart:io' show Platform;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/core/rtc/rtc_session.dart';
import 'package:platform_client/core/rtc/screen_capture.dart';

import 'fake_webrtc_platform.dart';

/// Android screen capture: consent first, then the foreground service; a
/// refusal starts nothing; stopping never throws.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const service = MethodChannel('pon/screen_share');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late FakeWebRtcPlatform native;
  late List<MethodCall> serviceCalls;

  setUp(() {
    native = FakeWebRtcPlatform()..install();
    serviceCalls = [];
    messenger.setMockMethodCallHandler(service, (call) async {
      serviceCalls.add(call);
      return null;
    });
  });
  tearDown(() {
    native.uninstall();
    messenger.setMockMethodCallHandler(service, null);
  });

  const notice = ScreenShareNotice(title: 'Sharing', body: 'Your screen');

  test('NoScreenCapture: unsupported, never begins, end is harmless',
      () async {
    const c = NoScreenCapture();
    expect(c.supported, isFalse);
    expect(await c.begin(notice), isFalse);
    await c.end();
  });

  test('platformScreenCapture picks the host for this platform', () {
    expect(platformScreenCapture(),
        Platform.isAndroid ? isA<AndroidScreenCapture>() : isA<NoScreenCapture>());
    expect(AndroidScreenCapture().supported, Platform.isAndroid);
  });

  test('end stops the service; a missing service is swallowed', () async {
    final c = AndroidScreenCapture();
    await c.end();
    expect(serviceCalls.single.method, 'stop');
    messenger.setMockMethodCallHandler(service,
        (_) async => throw PlatformException(code: 'not_running'));
    await c.end(); // must not throw
  });

  test('begin off Android: consent unavailable, service never started',
      () async {
    // Helper.requestCapturePermission() throws off Android; the foreground
    // service must not be started before consent.
    await expectLater(
        AndroidScreenCapture().begin(notice), throwsA(isA<Exception>()));
    expect(serviceCalls, isEmpty);
  }, skip: Platform.isAndroid);
}
