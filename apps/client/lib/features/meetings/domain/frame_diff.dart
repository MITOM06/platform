// Change detection for the shared-screen frames sent to the AI notes —
// mirror of web `lib/meetings/frame-diff.ts` (same names and constants).
// Pure: no platform, no I/O.

import 'dart:math' as math;
import 'dart:typed_data';

import 'package:image/image.dart' as img;

const int kScreenCheckMs = 5000;
const int kScreenMinGapMs = 15000;
const double kScreenDiffThreshold = 0.06;
const int kThumbW = 32;
const int kThumbH = 18;
const int kScreenMaxEdge = 1280;
const int kScreenJpegQuality = 70;

/// Mean absolute difference of two grayscale thumbnails, 0..1 (0 identical,
/// 1 black vs white). Different lengths ⇒ 1 (empty vs empty ⇒ 0).
double thumbnailDiff(List<int> a, List<int> b) {
  if (a.length != b.length) return 1;
  if (a.isEmpty) return 0;
  var sum = 0;
  for (var i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]).abs();
  }
  return sum / (a.length * 255);
}

/// First frame always goes; later ones only when the content changed AND at
/// least [kScreenMinGapMs] passed since the last one sent.
bool shouldSend(
    {required bool changed, required int? lastSentAt, required int now}) {
  if (lastSentAt == null) return true;
  return changed && now - lastSentAt >= kScreenMinGapMs;
}

/// What one capture turned into: its thumbnail and, when it should be sent,
/// the JPEG.
class ProcessedFrame {
  const ProcessedFrame(this.thumb, this.jpeg);

  final List<int> thumb;
  final Uint8List? jpeg;
}

/// Decode [bytes] (PNG from `captureFrame`), build the 32×18 grayscale
/// thumbnail, compare with the last SENT one and, if it should go, resize
/// (long edge ≤ [kScreenMaxEdge]) and encode JPEG. null = undecodable.
/// Heavy: run it in an isolate.
ProcessedFrame? processScreenFrame(
    Uint8List bytes, List<int>? lastThumb, int? lastSentAt, int now) {
  final image = img.decodeImage(bytes);
  if (image == null || image.width == 0 || image.height == 0) return null;
  final thumb = _thumbnail(image);
  final changed = lastThumb == null ||
      thumbnailDiff(lastThumb, thumb) >= kScreenDiffThreshold;
  if (!shouldSend(changed: changed, lastSentAt: lastSentAt, now: now)) {
    return ProcessedFrame(thumb, null);
  }
  final long = math.max(image.width, image.height);
  final out = long <= kScreenMaxEdge
      ? image
      : img.copyResize(image,
          width: image.width >= image.height ? kScreenMaxEdge : null,
          height: image.height > image.width ? kScreenMaxEdge : null,
          interpolation: img.Interpolation.average);
  return ProcessedFrame(thumb,
      Uint8List.fromList(img.encodeJpg(out, quality: kScreenJpegQuality)));
}

List<int> _thumbnail(img.Image image) {
  final small = img.copyResize(image,
      width: kThumbW,
      height: kThumbH,
      interpolation: img.Interpolation.average);
  final out = List<int>.filled(kThumbW * kThumbH, 0);
  for (var y = 0; y < kThumbH; y++) {
    for (var x = 0; x < kThumbW; x++) {
      final p = small.getPixel(x, y);
      out[y * kThumbW + x] =
          (0.299 * p.r + 0.587 * p.g + 0.114 * p.b).round().clamp(0, 255);
    }
  }
  return out;
}
