import 'package:flutter/widgets.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import 'video_fit.dart';

/// The picture's aspect ratio (rotation applied), or null before the first frame.
double? videoAspectOf(RTCVideoValue value) =>
    value.width > 0 && value.height > 0 ? value.aspectRatio : null;

/// An [RTCVideoView] that fills its box when the picture's shape is close and
/// shows it whole when filling would crop most of it (see [shouldContain]).
/// Re-evaluates when the sender rotates (the renderer notifies a new size) and
/// when the box changes. An explicit [fit] wins (screen shares: contain).
class AdaptiveVideoView extends StatelessWidget {
  const AdaptiveVideoView(this.renderer,
      {super.key, this.mirror = false, this.fit});

  final RTCVideoRenderer renderer;
  final bool mirror;
  final RTCVideoViewObjectFit? fit;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => ValueListenableBuilder<RTCVideoValue>(
        valueListenable: renderer,
        builder: (context, value, _) => RTCVideoView(
          renderer,
          mirror: mirror,
          objectFit: fit ??
              (shouldContain(videoAspectOf(value), constraints.biggest)
                  ? RTCVideoViewObjectFit.RTCVideoViewObjectFitContain
                  : RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
        ),
      ),
    );
  }
}
