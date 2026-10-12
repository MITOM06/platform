import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:platform_client/core/rtc/adaptive_video_view.dart';
import 'package:platform_client/core/rtc/video_fit.dart';

const phonePortrait = 720 / 1280;
const laptopLandscape = 1280 / 720;

/// A phone sends portrait video, a laptop landscape. Covering the other side's
/// screen kept about a third of a portrait picture on a landscape screen and
/// cut both sides of a laptop picture on a phone.
void main() {
  group('shouldContain', () {
    test('shows the whole picture when cover would crop most of it', () {
      expect(
          coverVisibleShare(phonePortrait, 1920 / 1080), closeTo(0.316, 0.01));
      expect(shouldContain(phonePortrait, const Size(1920, 1080)), isTrue);
      expect(shouldContain(laptopLandscape, const Size(390, 844)), isTrue);
    });

    test('fills the box when the shapes are close', () {
      expect(shouldContain(laptopLandscape, const Size(1920, 1080)), isFalse);
      expect(shouldContain(phonePortrait, const Size(390, 844)), isFalse);
      expect(shouldContain(16 / 9, const Size(800, 600)), isFalse);
    });

    test('covers until the picture and the box are known', () {
      expect(shouldContain(null, const Size(390, 844)), isFalse);
      expect(shouldContain(phonePortrait, Size.zero), isFalse);
      expect(shouldContain(phonePortrait, const Size(double.infinity, 400)),
          isFalse);
    });
  });

  group('selfViewSize', () {
    test('takes the camera shape: portrait phone, landscape laptop', () {
      expect(selfViewSize(phonePortrait), const Size(84, 150));
      expect(selfViewSize(laptopLandscape), const Size(150, 84));
    });

    test('is the old portrait box until the camera is known', () {
      expect(selfViewSize(null), const Size(100, 150));
    });
  });

  group('AdaptiveVideoView', () {
    late RTCVideoRenderer renderer;
    setUp(() => renderer = RTCVideoRenderer());

    Future<RTCVideoViewObjectFit> fitIn(WidgetTester tester, Size box) async {
      await tester.pumpWidget(Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: SizedBox(
              width: box.width,
              height: box.height,
              child: AdaptiveVideoView(renderer)),
        ),
      ));
      return tester.widget<RTCVideoView>(find.byType(RTCVideoView)).objectFit;
    }

    testWidgets(
        'a portrait phone picture is shown whole on a landscape box, and follows a rotation',
        (tester) async {
      renderer.value = const RTCVideoValue(width: 720, height: 1280);
      expect(await fitIn(tester, const Size(800, 450)),
          RTCVideoViewObjectFit.RTCVideoViewObjectFitContain);

      // The sender turns the phone: frames arrive with a 90° rotation flag.
      renderer.value =
          const RTCVideoValue(width: 720, height: 1280, rotation: 90);
      await tester.pump();
      expect(tester.widget<RTCVideoView>(find.byType(RTCVideoView)).objectFit,
          RTCVideoViewObjectFit.RTCVideoViewObjectFitCover);
    });

    testWidgets('covers before the first frame', (tester) async {
      expect(await fitIn(tester, const Size(800, 450)),
          RTCVideoViewObjectFit.RTCVideoViewObjectFitCover);
    });
  });
}
