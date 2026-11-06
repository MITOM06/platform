import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:platform_client/features/meetings/domain/frame_diff.dart';

Uint8List _png(int w, int h, int gray) {
  final im = img.Image(width: w, height: h);
  img.fill(im, color: img.ColorRgb8(gray, gray, gray));
  return Uint8List.fromList(img.encodePng(im));
}

void main() {
  test('constants mirror web', () {
    expect(kScreenCheckMs, 5000);
    expect(kScreenMinGapMs, 15000);
    expect(kScreenDiffThreshold, 0.06);
    expect((kThumbW, kThumbH), (32, 18));
    expect(kScreenMaxEdge, 1280);
    expect(kScreenJpegQuality, 70);
  });

  group('thumbnailDiff', () {
    test('identical 0, black vs white 1', () {
      expect(thumbnailDiff([1, 2, 3], [1, 2, 3]), 0);
      expect(thumbnailDiff([0, 0], [255, 255]), 1);
    });
    test('mean absolute difference on 0..1', () {
      expect(thumbnailDiff([0, 0], [51, 0]), closeTo(0.1, 1e-9));
    });
    test('length mismatch is 1, empty is 0', () {
      expect(thumbnailDiff([1], [1, 2]), 1);
      expect(thumbnailDiff([], []), 0);
    });
  });

  group('shouldSend', () {
    test('first frame always', () {
      expect(shouldSend(changed: false, lastSentAt: null, now: 0), true);
    });
    test('needs change and 15 s gap', () {
      expect(shouldSend(changed: true, lastSentAt: 0, now: 14999), false);
      expect(shouldSend(changed: true, lastSentAt: 0, now: 15000), true);
      expect(shouldSend(changed: false, lastSentAt: 0, now: 60000), false);
    });
  });

  group('processScreenFrame', () {
    test('first frame: 32x18 thumbnail + JPEG', () {
      final r = processScreenFrame(_png(64, 36, 200), null, null, 0)!;
      expect(r.thumb.length, 32 * 18);
      expect(r.thumb.every((v) => v == 200), true);
      final jpeg = r.jpeg!;
      expect(jpeg[0], 0xFF);
      expect(jpeg[1], 0xD8);
    });
    test('long edge above 1280 is scaled down', () {
      final r = processScreenFrame(_png(2560, 1440, 10), null, null, 0)!;
      final out = img.decodeJpg(r.jpeg!)!;
      expect(out.width, 1280);
      expect(out.height, 720);
    });
    test('portrait: height is the long edge', () {
      final r = processScreenFrame(_png(1440, 2560, 10), null, null, 0)!;
      final out = img.decodeJpg(r.jpeg!)!;
      expect(out.height, 1280);
      expect(out.width, 720);
    });
    test('unchanged or too soon: thumbnail only', () {
      final same = List<int>.filled(32 * 18, 200);
      expect(processScreenFrame(_png(64, 36, 200), same, 0, 60000)!.jpeg, null);
      final dark = List<int>.filled(32 * 18, 0);
      expect(processScreenFrame(_png(64, 36, 200), dark, 0, 5000)!.jpeg, null);
      expect(processScreenFrame(_png(64, 36, 200), dark, 0, 15000)!.jpeg,
          isNotNull);
    });
    test('garbage bytes: null', () {
      expect(processScreenFrame(Uint8List.fromList([1, 2, 3]), null, null, 0),
          null);
    });
  });
}
