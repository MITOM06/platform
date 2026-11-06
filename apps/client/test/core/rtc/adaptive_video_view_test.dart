import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/core/rtc/adaptive_video_view.dart';

import 'fake_webrtc_platform.dart';

void main() {
  group('videoAspectOf', () {
    test('unknown before the first frame', () {
      expect(videoAspectOf(RTCVideoValue.empty), isNull);
      expect(videoAspectOf(const RTCVideoValue(width: 640)), isNull);
    });

    test('rotation applied: a portrait phone sending landscape pixels', () {
      expect(videoAspectOf(const RTCVideoValue(width: 640, height: 480)),
          closeTo(4 / 3, 1e-9));
      expect(
          videoAspectOf(
              const RTCVideoValue(width: 640, height: 480, rotation: 90)),
          closeTo(3 / 4, 1e-9));
    });
  });

  group('AdaptiveVideoView', () {
    late FakeWebRtcPlatform native;
    setUp(() => native = FakeWebRtcPlatform()..install());
    tearDown(() => native.uninstall());

    Future<RTCVideoRenderer> renderer(WidgetTester tester) async {
      final r = RTCVideoRenderer();
      await tester.runAsync(r.initialize);
      return r;
    }

    RTCVideoViewObjectFit fitOf(WidgetTester tester) =>
        tester.widget<RTCVideoView>(find.byType(RTCVideoView)).objectFit;

    Widget box(Widget child, Size size) => Directionality(
          textDirection: TextDirection.ltr,
          child: Center(
              child: SizedBox(
                  width: size.width, height: size.height, child: child)),
        );

    testWidgets('covers until the picture size is known, then adapts',
        (tester) async {
      final r = await renderer(tester);
      // Landscape box (16:9).
      await tester.pumpWidget(box(AdaptiveVideoView(r), const Size(320, 180)));
      expect(fitOf(tester), RTCVideoViewObjectFit.RTCVideoViewObjectFitCover);

      // A portrait phone picture in a landscape box: shown whole.
      r.value = const RTCVideoValue(width: 720, height: 1280);
      await tester.pump();
      expect(fitOf(tester), RTCVideoViewObjectFit.RTCVideoViewObjectFitContain);

      // It rotates to landscape: fills the box again.
      r.value = const RTCVideoValue(width: 720, height: 1280, rotation: 90);
      await tester.pump();
      expect(fitOf(tester), RTCVideoViewObjectFit.RTCVideoViewObjectFitCover);
    });

    testWidgets('an explicit fit (screen share) wins, mirror passed through',
        (tester) async {
      final r = await renderer(tester);
      r.value = const RTCVideoValue(width: 1280, height: 720);
      await tester.pumpWidget(box(
          AdaptiveVideoView(r,
              mirror: true,
              fit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain),
          const Size(320, 180)));
      final view = tester.widget<RTCVideoView>(find.byType(RTCVideoView));
      expect(view.objectFit, RTCVideoViewObjectFit.RTCVideoViewObjectFitContain);
      expect(view.mirror, isTrue);
    });
  });
}
