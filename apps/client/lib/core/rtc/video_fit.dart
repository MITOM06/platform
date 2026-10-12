// How a call video fits its box. Mirror of web `lib/webrtc/video-fit.ts`.
//
// A phone sends portrait video and a laptop landscape: covering the other
// side's screen kept about a third of a portrait picture on a landscape screen
// and cut both sides of a laptop picture on a phone, so a mismatched shape is
// shown whole (contain, black bars).

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Below this share of the picture left visible by cover, show it whole.
/// 16:9 in a 4:3 box keeps 75%.
const double kMinCoverVisible = 0.75;

/// Share of the picture (0–1) still visible when [videoAspect] covers a box
/// of [boxAspect] (both width / height).
double coverVisibleShare(double videoAspect, double boxAspect) =>
    math.min(videoAspect, boxAspect) / math.max(videoAspect, boxAspect);

/// True when the picture should be shown whole; cover until both are known.
bool shouldContain(double? videoAspect, Size box) {
  if (videoAspect == null || videoAspect <= 0) return false;
  if (!box.isFinite || box.isEmpty) return false;
  return coverVisibleShare(videoAspect, box.width / box.height) <
      kMinCoverVisible;
}

/// Self-view size: the camera's own shape, longest side [long] (portrait until known).
Size selfViewSize(double? videoAspect, {double long = 150}) {
  if (videoAspect == null || videoAspect <= 0) return Size(long * 2 / 3, long);
  final short = (long * math.min(videoAspect, 1 / videoAspect)).roundToDouble();
  return videoAspect >= 1 ? Size(long, short) : Size(short, long);
}
