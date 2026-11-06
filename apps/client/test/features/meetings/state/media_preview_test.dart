import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:platform_client/features/meetings/domain/device_prefs.dart';
import 'package:platform_client/features/meetings/state/media_preview.dart';

import '../../../core/rtc/fake_webrtc_platform.dart';

/// Pre-join camera/mic preview: falls back to whatever device still works,
/// classifies why (blocked vs unavailable) without leaking platform text,
/// never keeps a stale capture after a newer toggle, release or dispose.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late FakeWebRtcPlatform native;
  late WebRtcMediaPreview preview;
  late int notified;

  setUp(() {
    native = FakeWebRtcPlatform()..install();
    preview = WebRtcMediaPreview();
    notified = 0;
    preview.addListener(() => notified++);
  });
  tearDown(() => native.uninstall());

  List<Map<Object?, Object?>> asked() => [
        for (final c in native.named('getUserMedia'))
          (c.arguments as Map)['constraints'] as Map<Object?, Object?>
      ];

  /// getUserMedia fails for any request that includes a kind in [failing].
  void failWhen(Set<String> failing, {String code = 'NotAllowedError'}) {
    native.onGetUserMedia = (c) async {
      final wantsAudio = c['audio'] == true;
      final wantsVideo = c['video'] != false && c['video'] != null;
      if ((wantsAudio && failing.contains('audio')) ||
          (wantsVideo && failing.contains('video'))) {
        // flutter_webrtc rethrows only the message: 'Unable to getUserMedia: …'.
        throw PlatformException(code: 'error', message: code);
      }
      return native.userMedia(audio: wantsAudio, video: wantsVideo);
    };
  }

  test('defaults before start: mic + front camera on, nothing captured', () {
    expect(preview.mic, isTrue);
    expect(preview.camera, isTrue);
    expect(preview.frontCamera, isTrue);
    expect(preview.stream, isNull);
    expect(preview.error, isNull);
  });

  test('start captures the saved choices', () async {
    preview.start(const DevicePrefs(frontCamera: false));
    await pumpEventQueue();
    expect(asked(), [
      {
        'audio': true,
        'video': {'facingMode': 'environment'}
      }
    ]);
    expect(preview.stream?.id, 'local1');
    expect(preview.error, isNull);
    expect(preview.frontCamera, isFalse);
    expect(notified, greaterThan(0));
  });

  test('both off: no capture at all', () async {
    preview.start(const DevicePrefs(micOn: false, camOn: false));
    await pumpEventQueue();
    expect(asked(), isEmpty);
    expect(preview.stream, isNull);
    expect(preview.error, isNull);
  });

  test('camera blocked: falls back to mic only, reports blocked', () async {
    failWhen({'video'});
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    expect(preview.mic, isTrue);
    expect(preview.camera, isFalse); // toggle follows reality
    expect(preview.stream, isNotNull);
    expect(preview.error, MediaPreviewError.blocked);
  });

  test('mic missing: falls back to camera only, reports unavailable',
      () async {
    failWhen({'audio'}, code: 'NotFoundError');
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    expect(asked(), hasLength(3)); // both, mic only, camera only
    expect(preview.mic, isFalse);
    expect(preview.camera, isTrue);
    expect(preview.error, MediaPreviewError.unavailable);
  });

  test('nothing works: both toggles off, no stream', () async {
    failWhen({'audio', 'video'}, code: 'Permission denied');
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    expect(preview.mic, isFalse);
    expect(preview.camera, isFalse);
    expect(preview.stream, isNull);
    expect(preview.error, MediaPreviewError.blocked);
  });

  test('a single device that fails is not retried', () async {
    failWhen({'video'}, code: 'NotReadableError');
    preview.start(const DevicePrefs(micOn: false));
    await pumpEventQueue();
    expect(asked(), hasLength(1));
    expect(preview.camera, isFalse);
    expect(preview.error, MediaPreviewError.unavailable);
  });

  test('flipping the camera stops the old capture first', () async {
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    preview.flipCamera();
    await pumpEventQueue();
    expect(native.named('trackDispose'), hasLength(2));
    expect(native.named('streamDispose'), hasLength(1));
    expect(asked().last['video'], {'facingMode': 'environment'});
    expect(preview.stream?.id, 'local2');
  });

  test('toggles: mic off, then camera off → nothing captured', () async {
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    preview.setMic(false);
    await pumpEventQueue();
    expect(asked().last, {
      'audio': false,
      'video': {'facingMode': 'user'}
    });
    preview.setCamera(false);
    await pumpEventQueue();
    expect(preview.stream, isNull);
    expect(asked(), hasLength(2));
  });

  test('a slower earlier capture never overrides a newer one', () async {
    final first = Completer<Map<String, Object?>>();
    var n = 0;
    native.onGetUserMedia = (c) {
      n++;
      return n == 1 ? first.future : Future.value(native.userMedia());
    };
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    preview.flipCamera(); // second request wins
    await pumpEventQueue();
    expect(preview.stream?.id, 'local1');
    first.complete(native.userMedia()); // the stale one (local2) arrives late
    await pumpEventQueue();
    expect(preview.stream?.id, 'local1');
    expect(native.argsOf('streamDispose', 'streamId'), ['local2']);
  });

  test('release stops the preview; a capture in flight is discarded',
      () async {
    final pending = Completer<Map<String, Object?>>();
    native.onGetUserMedia = (_) => pending.future;
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    preview.release();
    pending.complete(native.userMedia());
    await pumpEventQueue();
    expect(preview.stream, isNull);
    expect(native.named('streamDispose'), hasLength(1)); // camera light off
  });

  test('release of a running preview stops its tracks', () async {
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    preview.release();
    await pumpEventQueue();
    expect(preview.stream, isNull);
    expect(native.named('trackDispose'), hasLength(2));
  });

  test('dispose mid-capture: late stream stopped, no notify after dispose',
      () async {
    final pending = Completer<Map<String, Object?>>();
    native.onGetUserMedia = (_) => pending.future;
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    preview.dispose();
    final before = notified;
    pending.complete(native.userMedia());
    await pumpEventQueue();
    expect(notified, before);
    expect(native.named('streamDispose'), hasLength(1));
  });

  test('a stream that is already gone does not break stopping', () async {
    preview.start(const DevicePrefs());
    await pumpEventQueue();
    native.failing.add('trackDispose');
    preview.release();
    await pumpEventQueue();
    expect(preview.stream, isNull);
  });

  test('the default factory builds the flutter_webrtc preview', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final make = container.read(mediaPreviewFactoryProvider);
    final p = make();
    expect(p, isA<WebRtcMediaPreview>());
    p.dispose();
  });
}
